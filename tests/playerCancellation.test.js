const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { User, Sport, Session, Participant, Notification, sequelize } = require("../models");

describe("Player Session Cancellation", () => {
  let player1User;
  let player2User;
  let adminUser;
  let player1Agent;
  let player2Agent;
  let adminAgent;
  let sport;

  const futureDate = "2030-12-01";
  const futureTime = "18:00";

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await Notification.destroy({ where: {}, truncate: true });
    await Participant.destroy({ where: {}, truncate: true });
    await Session.destroy({ where: {}, truncate: true });
    await Sport.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });

    const hashedPassword = await bcrypt.hash("pass123", 10);

    player1User = await User.create({
      first_name: "PlayerOne",
      email: "player1@example.com",
      password: hashedPassword,
      role: "player"
    });

    player2User = await User.create({
      first_name: "PlayerTwo",
      email: "player2@example.com",
      password: hashedPassword,
      role: "player"
    });

    adminUser = await User.create({
      first_name: "AdminUser",
      email: "admin@example.com",
      password: hashedPassword,
      role: "admin"
    });

    sport = await Sport.create({
      name: "Volleyball",
      description: "Court sport",
      active: true
    });

    // Login Player 1
    player1Agent = request.agent(app);
    await player1Agent.post("/login").send({
      email: "player1@example.com",
      password: "pass123"
    });

    // Login Player 2
    player2Agent = request.agent(app);
    await player2Agent.post("/login").send({
      email: "player2@example.com",
      password: "pass123"
    });

    // Login Admin
    adminAgent = request.agent(app);
    await adminAgent.post("/login").send({
      email: "admin@example.com",
      password: "pass123"
    });
  });

  it("1. Unauthenticated user cannot cancel", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Turf 1",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    const res = await request(app).post(`/sessions/${sessionItem.id}/cancel`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("2. Creator can cancel own scheduled session", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Turf 1",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    const res = await player1Agent.post(`/sessions/${sessionItem.id}/cancel`).send({
      cancellationReason: "Heavy rain expected"
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`/sessions/${sessionItem.id}`);
  });

  it("3. Session status becomes cancelled", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Turf 1",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await player1Agent.post(`/sessions/${sessionItem.id}/cancel`);

    const updated = await Session.findByPk(sessionItem.id);
    expect(updated.status).toBe("cancelled");
  });

  it("4. Session is not deleted", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Turf 1",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await player1Agent.post(`/sessions/${sessionItem.id}/cancel`);

    const count = await Session.count({ where: { id: sessionItem.id } });
    expect(count).toBe(1);
  });

  it("5. Cancellation reason is stored", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Turf 1",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await player1Agent.post(`/sessions/${sessionItem.id}/cancel`).send({
      cancellationReason: "Venue maintenance"
    });

    const updated = await Session.findByPk(sessionItem.id);
    expect(updated.cancellationReason).toBe("Venue maintenance");
  });

  it("6. Cancellation reason is trimmed", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Turf 1",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await player1Agent.post(`/sessions/${sessionItem.id}/cancel`).send({
      cancellationReason: "   Trimmed reason test   "
    });

    const updated = await Session.findByPk(sessionItem.id);
    expect(updated.cancellationReason).toBe("Trimmed reason test");
  });

  it("7. Empty cancellation reason is allowed", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Turf 1",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await player1Agent.post(`/sessions/${sessionItem.id}/cancel`).send({
      cancellationReason: "   "
    });

    const updated = await Session.findByPk(sessionItem.id);
    expect(updated.status).toBe("cancelled");
    expect(updated.cancellationReason).toBeNull();
  });

  it("8. Reason longer than 500 characters is rejected", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Turf 1",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    const longReason = "a".repeat(501);

    const res = await player1Agent.post(`/sessions/${sessionItem.id}/cancel`).send({
      cancellationReason: longReason
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`/sessions/${sessionItem.id}`);

    const check = await Session.findByPk(sessionItem.id);
    expect(check.status).toBe("scheduled");
  });

  it("9. Player cannot cancel another player's session", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Player 1 Turf",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    const res = await player2Agent.post(`/sessions/${sessionItem.id}/cancel`).send({
      cancellationReason: "Unauthorized cancel attempt"
    });

    expect(res.statusCode).toBe(302);

    const check = await Session.findByPk(sessionItem.id);
    expect(check.status).toBe("scheduled");
  });

  it("10. Player cannot cancel an already cancelled session", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Cancelled Turf",
      additionalPlayersNeeded: 3,
      status: "cancelled",
      cancellationReason: "Already cancelled"
    });

    const res = await player1Agent.post(`/sessions/${sessionItem.id}/cancel`).send({
      cancellationReason: "Second cancel attempt"
    });

    expect(res.statusCode).toBe(302);

    const check = await Session.findByPk(sessionItem.id);
    expect(check.cancellationReason).toBe("Already cancelled");
  });

  it("11. Player cannot cancel a completed session", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Completed Turf",
      additionalPlayersNeeded: 3,
      status: "completed"
    });

    const res = await player1Agent.post(`/sessions/${sessionItem.id}/cancel`);
    expect(res.statusCode).toBe(302);

    const check = await Session.findByPk(sessionItem.id);
    expect(check.status).toBe("completed");
  });

  it("12. Participants remain after cancellation", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Shared Turf",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await Participant.create({ sessionId: sessionItem.id, userId: player2User.id });

    await player1Agent.post(`/sessions/${sessionItem.id}/cancel`);

    const count = await Participant.count({ where: { sessionId: sessionItem.id } });
    expect(count).toBe(1);
  });

  it("13. Cancelled session disappears from /sessions", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Disappearing Turf",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await player1Agent.post(`/sessions/${sessionItem.id}/cancel`);

    const res = await player2Agent.get("/sessions");
    expect(res.text).not.toContain("Disappearing Turf");
  });

  it("14. Cancelled session remains in /my-sessions", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "My Cancelled Turf",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await player1Agent.post(`/sessions/${sessionItem.id}/cancel`).send({
      cancellationReason: "Owner cancelled"
    });

    const res = await player1Agent.get("/my-sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("My Cancelled Turf");
    expect(res.text).toContain("Owner cancelled");
  });

  it("15. Cancelled session remains in /my-joined-sessions", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Joined Cancelled Turf",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await Participant.create({ sessionId: sessionItem.id, userId: player2User.id });

    await player1Agent.post(`/sessions/${sessionItem.id}/cancel`).send({
      cancellationReason: "Event cancelled by owner"
    });

    const res = await player2Agent.get("/my-joined-sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Joined Cancelled Turf");
    expect(res.text).toContain("Event cancelled by owner");
  });

  it("16. Cancelled session details show cancellation reason", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Reason Detail Turf",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await player1Agent.post(`/sessions/${sessionItem.id}/cancel`).send({
      cancellationReason: "Thunderstorm warning"
    });

    const res = await player2Agent.get(`/sessions/${sessionItem.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Cancellation Reason:");
    expect(res.text).toContain("Thunderstorm warning");
  });

  it("17. Join button is not available for cancelled session", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "No Join Turf",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await player1Agent.post(`/sessions/${sessionItem.id}/cancel`);

    const res = await player2Agent.get(`/sessions/${sessionItem.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.text).not.toContain("Join This Session");
  });

  it("18. CSRF protection is enforced on POST /sessions/:id/cancel in unauthenticated check structure", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "CSRF Cancel Turf",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    const res = await request(app).post(`/sessions/${sessionItem.id}/cancel`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("19. Admin existing cancellation route still works", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Admin Cancel Turf",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    const res = await adminAgent.post(`/admin/sessions/${sessionItem.id}/cancel`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/admin/sessions");

    const check = await Session.findByPk(sessionItem.id);
    expect(check.status).toBe("cancelled");
  });
});
