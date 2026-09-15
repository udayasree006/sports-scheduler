const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { User, Sport, Session, Participant, Notification, sequelize } = require("../models");

describe("Admin Reports & Analytics", () => {
  let adminUser;
  let playerUser;
  let adminAgent;
  let playerAgent;
  let footballSport;
  let tennisSport;

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

    footballSport = await Sport.create({
      name: "Football",
      description: "Outdoor sport",
      active: true
    });

    tennisSport = await Sport.create({
      name: "Tennis",
      description: "Racket sport",
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

  it("1. Admin can access /admin/reports", async () => {
    const res = await adminAgent.get("/admin/reports");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Admin Reports & Analytics");
  });

  it("2. Player cannot access /admin/reports", async () => {
    const res = await playerAgent.get("/admin/reports");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  it("3. Logged-out user cannot access /admin/reports", async () => {
    const res = await request(app).get("/admin/reports");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("4. Report shows completed sessions", async () => {
    const sessionItem = await Session.create({
      sportId: footballSport.id,
      creatorId: adminUser.id,
      date: "2026-05-10",
      time: "15:00",
      venue: "Completed Turf",
      additionalPlayersNeeded: 2,
      status: "completed"
    });

    const res = await adminAgent.get("/admin/reports");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Sessions Played (Completed Sessions)");
    expect(res.text).toContain("Completed Turf");
    expect(res.text).toContain("Football");
  });

  it("5. Date filtering works correctly", async () => {
    // Session inside range
    await Session.create({
      sportId: footballSport.id,
      creatorId: adminUser.id,
      date: "2026-06-15",
      time: "10:00",
      venue: "June Court",
      additionalPlayersNeeded: 4,
      status: "completed"
    });

    // Session outside range
    await Session.create({
      sportId: tennisSport.id,
      creatorId: adminUser.id,
      date: "2026-08-20",
      time: "10:00",
      venue: "August Court",
      additionalPlayersNeeded: 4,
      status: "completed"
    });

    const res = await adminAgent
      .get("/admin/reports")
      .query({ startDate: "2026-06-01", endDate: "2026-06-30" });

    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("June Court");
    expect(res.text).not.toContain("August Court");
  });

  it("6. Sport popularity is calculated correctly", async () => {
    // Football session with 2 participants
    const s1 = await Session.create({
      sportId: footballSport.id,
      creatorId: adminUser.id,
      date: "2026-05-10",
      time: "15:00",
      venue: "Turf 1",
      additionalPlayersNeeded: 2,
      status: "completed"
    });
    await Participant.create({ sessionId: s1.id, userId: playerUser.id });
    await Participant.create({ sessionId: s1.id, userId: adminUser.id });

    // Tennis session with 1 participant
    const s2 = await Session.create({
      sportId: tennisSport.id,
      creatorId: adminUser.id,
      date: "2026-05-12",
      time: "16:00",
      venue: "Turf 2",
      additionalPlayersNeeded: 1,
      status: "completed"
    });
    await Participant.create({ sessionId: s2.id, userId: playerUser.id });

    const res = await adminAgent.get("/admin/reports");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Sport Popularity Ranking");
    
    // Football should be rank #1 (2 participants), Tennis rank #2 (1 participant)
    const footballIndex = res.text.indexOf("Football");
    const tennisIndex = res.text.indexOf("Tennis");
    expect(footballIndex).toBeGreaterThan(-1);
    expect(tennisIndex).toBeGreaterThan(-1);
    expect(footballIndex).toBeLessThan(tennisIndex);
  });

  it("7. Participant counts are correct", async () => {
    const sessionItem = await Session.create({
      sportId: footballSport.id,
      creatorId: adminUser.id,
      date: "2026-05-10",
      time: "15:00",
      venue: "Turf 1",
      additionalPlayersNeeded: 2,
      status: "completed"
    });

    await Participant.create({ sessionId: sessionItem.id, userId: playerUser.id });

    const res = await adminAgent.get("/admin/reports");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Total Participants");
  });

  it("8. Empty date-range results are handled gracefully", async () => {
    const res = await adminAgent
      .get("/admin/reports")
      .query({ startDate: "2099-01-01", endDate: "2099-01-31" });

    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("No sessions found for the selected period.");
  });

  it("9. Invalid date range (startDate > endDate) is handled", async () => {
    const res = await adminAgent
      .get("/admin/reports")
      .query({ startDate: "2026-12-31", endDate: "2026-01-01" });

    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Start date cannot be after end date.");
  });
});
