const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { User, Sport, Session, Participant, Notification, sequelize } = require("../models");

describe("My Joined Sessions & Session Tracking", () => {
  let player1User;
  let player2User;
  let creatorUser;
  let player1Agent;
  let player2Agent;
  let sport;

  const date1 = "2030-11-01";
  const time1 = "10:00";
  const date2 = "2030-12-01";
  const time2 = "18:00";

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

    creatorUser = await User.create({
      first_name: "CreatorUser",
      email: "creator@example.com",
      password: hashedPassword,
      role: "player"
    });

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

    sport = await Sport.create({
      name: "Badminton",
      description: "Racket sport",
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
  });

  it("1. Unauthenticated user cannot access /my-joined-sessions", async () => {
    const res = await request(app).get("/my-joined-sessions");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("2. Logged-in player can access /my-joined-sessions", async () => {
    const res = await player1Agent.get("/my-joined-sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("My Joined Sessions");
  });

  it("3. Joined session appears in the list", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: creatorUser.id,
      date: date1,
      time: time1,
      venue: "Joined Badminton Court",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await Participant.create({
      sessionId: sessionItem.id,
      userId: player1User.id
    });

    const res = await player1Agent.get("/my-joined-sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Joined Badminton Court");
  });

  it("4. Session not joined by the player does not appear", async () => {
    await Session.create({
      sportId: sport.id,
      creatorId: creatorUser.id,
      date: date1,
      time: time1,
      venue: "Unjoined Badminton Court",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    const res = await player1Agent.get("/my-joined-sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).not.toContain("Unjoined Badminton Court");
  });

  it("5. Another player's joined sessions do not leak into current player's list", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: creatorUser.id,
      date: date1,
      time: time1,
      venue: "Player 2 Only Court",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    // Player 2 joins
    await Participant.create({
      sessionId: sessionItem.id,
      userId: player2User.id
    });

    // Player 1 views my-joined-sessions
    const res = await player1Agent.get("/my-joined-sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).not.toContain("Player 2 Only Court");
  });

  it("6. Multiple joined sessions appear correctly", async () => {
    const s1 = await Session.create({
      sportId: sport.id,
      creatorId: creatorUser.id,
      date: date1,
      time: time1,
      venue: "First Joined Court",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    const s2 = await Session.create({
      sportId: sport.id,
      creatorId: creatorUser.id,
      date: date2,
      time: time2,
      venue: "Second Joined Court",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await Participant.create({ sessionId: s1.id, userId: player1User.id });
    await Participant.create({ sessionId: s2.id, userId: player1User.id });

    const res = await player1Agent.get("/my-joined-sessions");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("First Joined Court");
    expect(res.text).toContain("Second Joined Court");
  });

  it("7. Sessions are sorted by date/time ascending", async () => {
    // Create later session first
    const sLater = await Session.create({
      sportId: sport.id,
      creatorId: creatorUser.id,
      date: date2,
      time: time2,
      venue: "Later Court",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    // Create earlier session second
    const sEarlier = await Session.create({
      sportId: sport.id,
      creatorId: creatorUser.id,
      date: date1,
      time: time1,
      venue: "Earlier Court",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await Participant.create({ sessionId: sLater.id, userId: player1User.id });
    await Participant.create({ sessionId: sEarlier.id, userId: player1User.id });

    const res = await player1Agent.get("/my-joined-sessions");
    expect(res.statusCode).toBe(200);
    const earlierIndex = res.text.indexOf("Earlier Court");
    const laterIndex = res.text.indexOf("Later Court");
    expect(earlierIndex).toBeGreaterThan(-1);
    expect(laterIndex).toBeGreaterThan(-1);
    expect(earlierIndex).toBeLessThan(laterIndex);
  });

  it("8. Session details correctly show that the current player has joined", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: creatorUser.id,
      date: date1,
      time: time1,
      venue: "Joined Detail Court",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await Participant.create({ sessionId: sessionItem.id, userId: player1User.id });

    const res = await player1Agent.get(`/sessions/${sessionItem.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("You have joined this session");
  });

  it("9. Already joined player cannot see the Join button", async () => {
    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: creatorUser.id,
      date: date1,
      time: time1,
      venue: "No Button Court",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    await Participant.create({ sessionId: sessionItem.id, userId: player1User.id });

    const res = await player1Agent.get(`/sessions/${sessionItem.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.text).not.toContain("Join This Session");
  });

  it("10. Creator is shown correctly but is not automatically treated as a participant", async () => {
    const creatorAgent = request.agent(app);
    await creatorAgent.post("/login").send({
      email: "creator@example.com",
      password: "pass123"
    });

    const sessionItem = await Session.create({
      sportId: sport.id,
      creatorId: creatorUser.id,
      date: date1,
      time: time1,
      venue: "Creator Court",
      additionalPlayersNeeded: 3,
      status: "scheduled"
    });

    const res = await creatorAgent.get(`/sessions/${sessionItem.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("CreatorUser");
    expect(res.text).toContain("You created this session");

    // Check Participant count in database
    const participantCount = await Participant.count({ where: { sessionId: sessionItem.id } });
    expect(participantCount).toBe(0);
  });
});
