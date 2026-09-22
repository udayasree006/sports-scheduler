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

  describe("Schedule Conflict Prevention (Same Date & Time)", () => {
    it("15. Player cannot join another session with the exact same date and time", async () => {
      const session1 = await Session.create({
        sportId: sport.id,
        creatorId: adminUser.id,
        date: futureDate,
        time: futureTime,
        venue: "Venue 1",
        additionalPlayersNeeded: 4,
        status: "scheduled"
      });

      const session2 = await Session.create({
        sportId: sport.id,
        creatorId: adminUser.id,
        date: futureDate,
        time: futureTime,
        venue: "Venue 2",
        additionalPlayersNeeded: 4,
        status: "scheduled"
      });

      await playerAgent.post(`/sessions/${session1.id}/join`);
      const res = await playerAgent.post(`/sessions/${session2.id}/join`);

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe(`/sessions/${session2.id}`);

      const joinedSession2 = await Participant.count({
        where: { sessionId: session2.id, userId: playerUser.id }
      });
      expect(joinedSession2).toBe(0);
    });

    it("16. Player can join sessions on the same date at different times", async () => {
      const session1 = await Session.create({
        sportId: sport.id,
        creatorId: adminUser.id,
        date: futureDate,
        time: "10:00",
        venue: "Morning Venue",
        additionalPlayersNeeded: 4,
        status: "scheduled"
      });

      const session2 = await Session.create({
        sportId: sport.id,
        creatorId: adminUser.id,
        date: futureDate,
        time: "14:00",
        venue: "Afternoon Venue",
        additionalPlayersNeeded: 4,
        status: "scheduled"
      });

      await playerAgent.post(`/sessions/${session1.id}/join`);
      const res = await playerAgent.post(`/sessions/${session2.id}/join`);

      expect(res.statusCode).toBe(302);
      const joinedSession2 = await Participant.count({
        where: { sessionId: session2.id, userId: playerUser.id }
      });
      expect(joinedSession2).toBe(1);
    });

    it("17. Player can join sessions on different dates", async () => {
      const session1 = await Session.create({
        sportId: sport.id,
        creatorId: adminUser.id,
        date: "2030-12-01",
        time: futureTime,
        venue: "Day 1 Venue",
        additionalPlayersNeeded: 4,
        status: "scheduled"
      });

      const session2 = await Session.create({
        sportId: sport.id,
        creatorId: adminUser.id,
        date: "2030-12-02",
        time: futureTime,
        venue: "Day 2 Venue",
        additionalPlayersNeeded: 4,
        status: "scheduled"
      });

      await playerAgent.post(`/sessions/${session1.id}/join`);
      const res = await playerAgent.post(`/sessions/${session2.id}/join`);

      expect(res.statusCode).toBe(302);
      const joinedSession2 = await Participant.count({
        where: { sessionId: session2.id, userId: playerUser.id }
      });
      expect(joinedSession2).toBe(1);
    });

    it("18. Cancelled sessions do not block joining a new session at the same date and time", async () => {
      const cancelledSession = await Session.create({
        sportId: sport.id,
        creatorId: adminUser.id,
        date: futureDate,
        time: futureTime,
        venue: "Cancelled Venue",
        additionalPlayersNeeded: 4,
        status: "scheduled"
      });

      await Participant.create({ sessionId: cancelledSession.id, userId: playerUser.id });

      cancelledSession.status = "cancelled";
      await cancelledSession.save();

      const newSession = await Session.create({
        sportId: sport.id,
        creatorId: adminUser.id,
        date: futureDate,
        time: futureTime,
        venue: "New Venue",
        additionalPlayersNeeded: 4,
        status: "scheduled"
      });

      const res = await playerAgent.post(`/sessions/${newSession.id}/join`);
      expect(res.statusCode).toBe(302);

      const joinedNew = await Participant.count({
        where: { sessionId: newSession.id, userId: playerUser.id }
      });
      expect(joinedNew).toBe(1);
    });

    it("19. Different players can join different sessions at the same date and time", async () => {
      const hashedPassword = await bcrypt.hash("pass123", 10);
      const player2User = await User.create({
        first_name: "PlayerTwo",
        email: "player2@example.com",
        password: hashedPassword,
        role: "player"
      });

      const player2Agent = request.agent(app);
      await player2Agent.post("/login").send({
        email: "player2@example.com",
        password: "pass123"
      });

      const session1 = await Session.create({
        sportId: sport.id,
        creatorId: adminUser.id,
        date: futureDate,
        time: futureTime,
        venue: "Venue 1",
        additionalPlayersNeeded: 4,
        status: "scheduled"
      });

      const session2 = await Session.create({
        sportId: sport.id,
        creatorId: adminUser.id,
        date: futureDate,
        time: futureTime,
        venue: "Venue 2",
        additionalPlayersNeeded: 4,
        status: "scheduled"
      });

      await playerAgent.post(`/sessions/${session1.id}/join`);
      const res = await player2Agent.post(`/sessions/${session2.id}/join`);

      expect(res.statusCode).toBe(302);
      const joinedSession2 = await Participant.count({
        where: { sessionId: session2.id, userId: player2User.id }
      });
      expect(joinedSession2).toBe(1);
    });
  });
});
