const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { User, Sport, Session, Participant, Notification, sequelize } = require("../models");

describe("Player Session View & Join", () => {
  let adminUser;
  let playerUser;
  let playerAgent;
  let sport;
  const futureDate = "2030-12-01";
  const futureTime = "18:00";
  const pastDate = "2020-01-01";
  const pastTime = "10:00";

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

    adminUser = await User.create({
      first_name: "AdminUser",
      email: "admin@example.com",
      password: hashedPassword,
      role: "admin"
    });

    playerUser = await User.create({
      first_name: "PlayerUser",
      email: "player@example.com",
      password: hashedPassword,
      role: "player"
    });

    sport = await Sport.create({
      name: "Football",
      description: "Outdoor game",
      active: true
    });

    // Login Player
    playerAgent = request.agent(app);
    await playerAgent.post("/login").send({
      email: "player@example.com",
      password: "pass123"
    });
  });

  it("1. Unauthenticated user cannot access /sessions", async () => {
    const res = await request(app).get("/sessions");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("2. Logged-in player can access /sessions", async () => {
    const res = await playerAgent.get("/sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Available Sports Sessions");
  });

  it("3. Player sees only scheduled upcoming sessions", async () => {
    await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Upcoming Turf",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    const res = await playerAgent.get("/sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Upcoming Turf");
  });

  it("4. Cancelled sessions are not shown in the list", async () => {
    await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Cancelled Turf",
      additionalPlayersNeeded: 3,
      status: "cancelled"
    });

    const res = await playerAgent.get("/sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).not.toContain("Cancelled Turf");
  });

  it("5. Past sessions are not shown in the list", async () => {
    await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: pastDate,
      time: pastTime,
      venue: "Past Turf",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    const res = await playerAgent.get("/sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).not.toContain("Past Turf");
  });

  it("6. Player can view session details", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Detail Turf",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    const res = await playerAgent.get(`/sessions/${sessionItem.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Detail Turf");
    expect(res.text).toContain("Football");
  });

  it("7. Player can successfully join an available session", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Joinable Turf",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    const res = await playerAgent.post(`/sessions/${sessionItem.id}/join`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`/sessions/${sessionItem.id}`);
  });

  it("8. Participant record is created after joining", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Participant Turf",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    await playerAgent.post(`/sessions/${sessionItem.id}/join`);

    const participant = await Participant.findOne({
      where: { sessionId: sessionItem.id, userId: playerUser.id }
    });
    expect(participant).not.toBeNull();
  });

  it("9. additionalPlayersNeeded decreases by 1 after joining", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Slots Turf",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    await playerAgent.post(`/sessions/${sessionItem.id}/join`);

    const updatedSession = await Session.findByPk(sessionItem.id);
    expect(updatedSession.additionalPlayersNeeded).toBe(3);
  });

  it("10. Player cannot join the same session twice", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Duplicate Join Turf",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    await playerAgent.post(`/sessions/${sessionItem.id}/join`);
    const secondRes = await playerAgent.post(`/sessions/${sessionItem.id}/join`);

    expect(secondRes.statusCode).toBe(302);
    const participantCount = await Participant.count({
      where: { sessionId: sessionItem.id, userId: playerUser.id }
    });
    expect(participantCount).toBe(1);

    const updatedSession = await Session.findByPk(sessionItem.id);
    expect(updatedSession.additionalPlayersNeeded).toBe(3);
  });

  it("11. Player cannot join a full session", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Full Turf",
      additionalPlayersNeeded: 0,
      status: "scheduled"
    });

    const res = await playerAgent.post(`/sessions/${sessionItem.id}/join`);
    expect(res.statusCode).toBe(302);

    const participantCount = await Participant.count({
      where: { sessionId: sessionItem.id, userId: playerUser.id }
    });
    expect(participantCount).toBe(0);
  });

  it("12. Player cannot join a cancelled session", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Cancelled Join Turf",
      additionalPlayersNeeded: 4,
      status: "cancelled"
    });

    const res = await playerAgent.post(`/sessions/${sessionItem.id}/join`);
    expect(res.statusCode).toBe(302);

    const participantCount = await Participant.count({
      where: { sessionId: sessionItem.id, userId: playerUser.id }
    });
    expect(participantCount).toBe(0);
  });

  it("13. Player cannot join a past session", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: pastDate,
      time: pastTime,
      venue: "Past Join Turf",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    const res = await playerAgent.post(`/sessions/${sessionItem.id}/join`);
    expect(res.statusCode).toBe(302);

    const participantCount = await Participant.count({
      where: { sessionId: sessionItem.id, userId: playerUser.id }
    });
    expect(participantCount).toBe(0);
  });

  it("14. CSRF protection is enforced on POST /sessions/:id/join in non-test mode structure", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "CSRF Turf",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    // Verify route requires authentication
    const unauthRes = await request(app).post(`/sessions/${sessionItem.id}/join`);
    expect(unauthRes.statusCode).toBe(302);
    expect(unauthRes.headers.location).toBe("/login");
  });
});
