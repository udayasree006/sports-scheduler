const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { User, Sport, Session, Participant, Notification, sequelize } = require("../models");

describe("Player Created Sports Sessions", () => {
  let player1User;
  let player2User;
  let player1Agent;
  let player2Agent;
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

    activeSport = await Sport.create({
      name: "Tennis",
      description: "Racket sport",
      active: true
    });

    inactiveSport = await Sport.create({
      name: "Polo",
      description: "Horse sport",
      active: false
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
  });

  it("1. Unauthenticated user cannot access GET /sessions/new", async () => {
    const res = await request(app).get("/sessions/new");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("2. Logged-in player can access GET /sessions/new", async () => {
    const res = await player1Agent.get("/sessions/new");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Create Sports Session");
  });

  it("3. Player can create a valid session", async () => {
    const res = await player1Agent.post("/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "Community Tennis Court",
      additionalPlayersNeeded: 2
    });

    expect(res.statusCode).toBe(302);

    const sessionItem = await Session.findOne({ where: { venue: "Community Tennis Court" } });
    expect(sessionItem).not.toBeNull();
    expect(sessionItem.sportId).toBe(activeSport.id);
  });

  it("4. Created session has creatorId equal to logged-in player", async () => {
    await player1Agent.post("/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "Player 1 Turf",
      additionalPlayersNeeded: 3
    });

    const sessionItem = await Session.findOne({ where: { venue: "Player 1 Turf" } });
    expect(sessionItem.creatorId).toBe(player1User.id);
  });

  it("5. Created session has status scheduled", async () => {
    await player1Agent.post("/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "Scheduled Turf",
      additionalPlayersNeeded: 3
    });

    const sessionItem = await Session.findOne({ where: { venue: "Scheduled Turf" } });
    expect(sessionItem.status).toBe("scheduled");
  });

  it("6. Inactive sport is rejected", async () => {
    const res = await player1Agent.post("/sessions").send({
      sportId: inactiveSport.id,
      date: futureDate,
      time: futureTime,
      venue: "Polo Club",
      additionalPlayersNeeded: 2
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/sessions/new");
    expect(await Session.count()).toBe(0);
  });

  it("7. Non-existent sport is rejected", async () => {
    const res = await player1Agent.post("/sessions").send({
      sportId: 99999,
      date: futureDate,
      time: futureTime,
      venue: "Fake Club",
      additionalPlayersNeeded: 2
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/sessions/new");
    expect(await Session.count()).toBe(0);
  });

  it("8. Empty venue is rejected", async () => {
    const res = await player1Agent.post("/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "   ",
      additionalPlayersNeeded: 2
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/sessions/new");
    expect(await Session.count()).toBe(0);
  });

  it("9. Negative additionalPlayersNeeded is rejected", async () => {
    const res = await player1Agent.post("/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "Court B",
      additionalPlayersNeeded: -2
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/sessions/new");
    expect(await Session.count()).toBe(0);
  });

  it("10. Past date/time is rejected", async () => {
    const res = await player1Agent.post("/sessions").send({
      sportId: activeSport.id,
      date: pastDate,
      time: pastTime,
      venue: "Past Court",
      additionalPlayersNeeded: 2
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/sessions/new");
    expect(await Session.count()).toBe(0);
  });

  it("11. Player cannot manually set another creator", async () => {
    await player1Agent.post("/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "Spoofed Creator Court",
      additionalPlayersNeeded: 2,
      creatorId: player2User.id
    });

    const sessionItem = await Session.findOne({ where: { venue: "Spoofed Creator Court" } });
    expect(sessionItem.creatorId).toBe(player1User.id);
  });

  it("12. Player-created session appears in /sessions", async () => {
    await player1Agent.post("/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "Public Browse Court",
      additionalPlayersNeeded: 4
    });

    const res = await player2Agent.get("/sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Public Browse Court");
  });

  it("13. Player-created session can be viewed", async () => {
    const sessionItem = await Session.create({
      sportId: activeSport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Viewable Court",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    const res = await player2Agent.get(`/sessions/${sessionItem.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Viewable Court");
  });

  it("14. Player-created session can be joined by another player", async () => {
    const sessionItem = await Session.create({
      sportId: activeSport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Joinable Court",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    const res = await player2Agent.post(`/sessions/${sessionItem.id}/join`);
    expect(res.statusCode).toBe(302);

    const participant = await Participant.findOne({
      where: { sessionId: sessionItem.id, userId: player2User.id }
    });
    expect(participant).not.toBeNull();
  });

  it("15. Creator is NOT automatically added as a Participant", async () => {
    await player1Agent.post("/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "Creator Check Court",
      additionalPlayersNeeded: 3
    });

    const sessionItem = await Session.findOne({ where: { venue: "Creator Check Court" } });
    const participant = await Participant.findOne({
      where: { sessionId: sessionItem.id, userId: player1User.id }
    });
    expect(participant).toBeNull();
  });

  it("16. /my-sessions shows only sessions created by the logged-in player", async () => {
    await Session.create({
      sportId: activeSport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Player 1 Created Court",
      additionalPlayersNeeded: 2,
      status: "scheduled"
    });

    const res = await player1Agent.get("/my-sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Player 1 Created Court");
  });

  it("17. Another player's created session does not appear in /my-sessions", async () => {
    await Session.create({
      sportId: activeSport.id,
      creatorId: player1User.id,
      date: futureDate,
      time: futureTime,
      venue: "Player 1 Court",
      additionalPlayersNeeded: 2,
      status: "scheduled"
    });

    const res = await player2Agent.get("/my-sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).not.toContain("Player 1 Court");
  });

  it("18. CSRF protection is enforced on POST /sessions in unauthenticated check structure", async () => {
    const res = await request(app).post("/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "CSRF Test Court",
      additionalPlayersNeeded: 2
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("19. Player can create a session with Team 1, Team 2, and existing player lists", async () => {
    const res = await player1Agent.post("/sessions").send({
      sportId: activeSport.id,
      date: futureDate,
      time: futureTime,
      venue: "College Ground",
      additionalPlayersNeeded: 3,
      team1Name: "Team A",
      team1Players: ["Udaya", "Sree", "Anjali"],
      team2Name: "Team B",
      team2Players: ["Rahul", "Kiran"]
    });

    expect(res.statusCode).toBe(302);

    const createdSession = await Session.findOne({
      where: { venue: "College Ground" }
    });

    expect(createdSession).not.toBeNull();
    expect(createdSession.team1Name).toBe("Team A");
    expect(createdSession.team1Players).toEqual(["Udaya", "Sree", "Anjali"]);
    expect(createdSession.team2Name).toBe("Team B");
    expect(createdSession.team2Players).toEqual(["Rahul", "Kiran"]);

    const detailsRes = await player1Agent.get(`/sessions/${createdSession.id}`);
    expect(detailsRes.statusCode).toBe(200);
    expect(detailsRes.text).toContain("Team A");
    expect(detailsRes.text).toContain("Team B");
    expect(detailsRes.text).toContain("Udaya");
    expect(detailsRes.text).toContain("Sree");
    expect(detailsRes.text).toContain("Anjali");
    expect(detailsRes.text).toContain("Rahul");
    expect(detailsRes.text).toContain("Kiran");
  });
});
