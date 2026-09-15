const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { User, Sport, Session, Participant, Notification, sequelize } = require("../models");

describe("Admin Session Completion & Join Protection", () => {
  let adminUser;
  let playerUser;
  let adminAgent;
  let playerAgent;
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
      name: "Handball",
      description: "Indoor team sport",
      active: true
    });

    // Login Admin
    adminAgent = request.agent(app);
    await adminAgent.post("/login").send({
      email: "admin@example.com",
      password: "pass123"
    });

    // Login Player
    playerAgent = request.agent(app);
    await playerAgent.post("/login").send({
      email: "player@example.com",
      password: "pass123"
    });
  });

  it("1. Admin can mark scheduled session completed", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Handball Court 1",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    const res = await adminAgent.post(`/admin/sessions/${sessionItem.id}/complete`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`/admin/sessions/${sessionItem.id}`);

    const updated = await Session.findByPk(sessionItem.id);
    expect(updated.status).toBe("completed");
  });

  it("2. Non-admin player cannot mark session completed", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Handball Court 1",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    const res = await playerAgent.post(`/admin/sessions/${sessionItem.id}/complete`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/");

    const check = await Session.findByPk(sessionItem.id);
    expect(check.status).toBe("scheduled");
  });

  it("3. Unauthenticated user cannot mark session completed", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Handball Court 1",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    const res = await request(app).post(`/admin/sessions/${sessionItem.id}/complete`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("4. Cancelled session cannot be completed", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Cancelled Handball Court",
      additionalPlayersNeeded: 4,
      status: "cancelled"
    });

    const res = await adminAgent.post(`/admin/sessions/${sessionItem.id}/complete`);
    expect(res.statusCode).toBe(302);

    const check = await Session.findByPk(sessionItem.id);
    expect(check.status).toBe("cancelled");
  });

  it("5. Already completed session cannot be completed again", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Completed Handball Court",
      additionalPlayersNeeded: 4,
      status: "completed"
    });

    const res = await adminAgent.post(`/admin/sessions/${sessionItem.id}/complete`);
    expect(res.statusCode).toBe(302);

    const check = await Session.findByPk(sessionItem.id);
    expect(check.status).toBe("completed");
  });

  it("6. Completed session cannot be joined by a player", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Completed Court Join Test",
      additionalPlayersNeeded: 4,
      status: "completed"
    });

    const res = await playerAgent.post(`/sessions/${sessionItem.id}/join`);
    expect(res.statusCode).toBe(302);

    const count = await Participant.count({ where: { sessionId: sessionItem.id } });
    expect(count).toBe(0);
  });

  it("7. Completed session displays Completed status in player view", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Completed Display Court",
      additionalPlayersNeeded: 4,
      status: "completed"
    });

    const res = await playerAgent.get(`/sessions/${sessionItem.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("completed");
    expect(res.text).not.toContain("Join This Session");
  });

  it("8. Regression: existing edit and cancel behavior still works", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Regression Venue",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    // Edit
    const resEdit = await adminAgent.post(`/admin/sessions/${sessionItem.id}`).send({
      sportId: sport.id,
      date: futureDate,
      time: futureTime,
      venue: "Edited Regression Venue",
      additionalPlayersNeeded: 3
    });
    expect(resEdit.statusCode).toBe(302);

    // Cancel
    const resCancel = await adminAgent.post(`/admin/sessions/${sessionItem.id}/cancel`);
    expect(resCancel.statusCode).toBe(302);

    const check = await Session.findByPk(sessionItem.id);
    expect(check.status).toBe("cancelled");
    expect(check.venue).toBe("Edited Regression Venue");
  });

  it("9. Regression: existing player join behavior still works for scheduled session", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Player Join Venue",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    const res = await playerAgent.post(`/sessions/${sessionItem.id}/join`);
    expect(res.statusCode).toBe(302);

    const participant = await Participant.findOne({ where: { sessionId: sessionItem.id, userId: playerUser.id } });
    expect(participant).not.toBeNull();
  });
});
