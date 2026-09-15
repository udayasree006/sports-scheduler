const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { User, Sport, Session, Notification, sequelize } = require("../models");

describe("Admin Sports Session Management", () => {
  let adminAgent;
  let playerAgent;
  let adminUser;
  let playerUser;
  let activeSport;
  let inactiveSport;

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

    activeSport = await Sport.create({
      name: "Football",
      description: "Active sport",
      active: true
    });

    inactiveSport = await Sport.create({
      name: "Golf",
      description: "Inactive sport",
      active: false
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

  it("1. Admin can access /admin/sessions", async () => {
    const res = await adminAgent.get("/admin/sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Manage Sports Sessions");
  });

  it("2. Player cannot access /admin/sessions", async () => {
    const res = await playerAgent.get("/admin/sessions");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  it("3. Unauthenticated user cannot access /admin/sessions", async () => {
    const res = await request(app).get("/admin/sessions");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("4. Admin can create a valid session", async () => {
    const res = await adminAgent.post("/admin/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "Main Stadium",
      additionalPlayersNeeded: 4
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/admin/sessions");

    const sessionItem = await Session.findOne({ where: { venue: "Main Stadium" } });
    expect(sessionItem).not.toBeNull();
    expect(sessionItem.sportId).toBe(activeSport.id);
    expect(sessionItem.additionalPlayersNeeded).toBe(4);
    expect(sessionItem.status).toBe("scheduled");
  });

  it("5. Session creator is automatically the logged-in admin", async () => {
    await adminAgent.post("/admin/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "Arena Court",
      additionalPlayersNeeded: 2
    });

    const sessionItem = await Session.findOne({ where: { venue: "Arena Court" } });
    expect(sessionItem.creatorId).toBe(adminUser.id);
  });

  it("6. Cannot create a session with an inactive or nonexistent sport", async () => {
    // Inactive sport
    const resInactive = await adminAgent.post("/admin/sessions").send({
      sportId: inactiveSport.id,
      date: futureDate,
      time: futureTime,
      venue: "Club House",
      additionalPlayersNeeded: 2
    });
    expect(resInactive.statusCode).toBe(302);
    expect(resInactive.headers.location).toBe("/admin/sessions/new");

    // Nonexistent sport
    const resNonexistent = await adminAgent.post("/admin/sessions").send({
      sportId: 99999,
      date: futureDate,
      time: futureTime,
      venue: "Club House",
      additionalPlayersNeeded: 2
    });
    expect(resNonexistent.statusCode).toBe(302);
    expect(resNonexistent.headers.location).toBe("/admin/sessions/new");

    const count = await Session.count();
    expect(count).toBe(0);
  });

  it("7. Cannot create a session with an empty venue", async () => {
    const res = await adminAgent.post("/admin/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "   ",
      additionalPlayersNeeded: 2
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/admin/sessions/new");
    expect(await Session.count()).toBe(0);
  });

  it("8. Cannot create a session with negative additional players", async () => {
    const res = await adminAgent.post("/admin/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "Community Ground",
      additionalPlayersNeeded: -3
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/admin/sessions/new");
    expect(await Session.count()).toBe(0);
  });

  it("9. Cannot create a session in the past", async () => {
    const res = await adminAgent.post("/admin/sessions").send({
      sportId: activeSport.id,
      date: pastDate,
      time: pastTime,
      venue: "Old Arena",
      additionalPlayersNeeded: 2
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/admin/sessions/new");
    expect(await Session.count()).toBe(0);
  });

  it("10. Admin can edit a scheduled session", async () => {
    const sessionItem = await Session.create({
      sportId: activeSport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Old Venue",
      additionalPlayersNeeded: 5,
      status: "scheduled"
    });

    const res = await adminAgent.post(`/admin/sessions/${sessionItem.id}`).send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "Updated Venue",
      additionalPlayersNeeded: 8
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/admin/sessions");

    const updated = await Session.findByPk(sessionItem.id);
    expect(updated.venue).toBe("Updated Venue");
    expect(updated.additionalPlayersNeeded).toBe(8);
  });

  it("11. Admin can cancel a scheduled session", async () => {
    const sessionItem = await Session.create({
      sportId: activeSport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Cancel Ground",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    const res = await adminAgent.post(`/admin/sessions/${sessionItem.id}/cancel`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/admin/sessions");

    const cancelled = await Session.findByPk(sessionItem.id);
    expect(cancelled.status).toBe("cancelled");
  });

  it("12. Cancelled session remains in the database", async () => {
    const sessionItem = await Session.create({
      sportId: activeSport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Persistent Ground",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    await adminAgent.post(`/admin/sessions/${sessionItem.id}/cancel`);

    const count = await Session.count({ where: { id: sessionItem.id } });
    expect(count).toBe(1);
  });

  it("13. Player cannot create a session through admin routes", async () => {
    const res = await playerAgent.post("/admin/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "Unauthorized Turf",
      additionalPlayersNeeded: 3
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/");
    expect(await Session.count()).toBe(0);
  });

  it("14. Player cannot cancel a session", async () => {
    const sessionItem = await Session.create({
      sportId: activeSport.id,
      creatorId: adminUser.id,
      date: futureDate,
      time: futureTime,
      venue: "Protected Turf",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    const res = await playerAgent.post(`/admin/sessions/${sessionItem.id}/cancel`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/");

    const checkSession = await Session.findByPk(sessionItem.id);
    expect(checkSession.status).toBe("scheduled");
  });
});
