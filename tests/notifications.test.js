const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { User, Sport, Session, Participant, Notification, sequelize } = require("../models");

describe("Step 15 — Notifications System", () => {
  let adminUser;
  let creatorPlayer;
  let joinerPlayer;
  let otherPlayer;
  let adminAgent;
  let creatorAgent;
  let joinerAgent;
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

    creatorPlayer = await User.create({
      first_name: "CreatorPlayer",
      email: "creator@example.com",
      password: hashedPassword,
      role: "player"
    });

    joinerPlayer = await User.create({
      first_name: "JoinerPlayer",
      email: "joiner@example.com",
      password: hashedPassword,
      role: "player"
    });

    otherPlayer = await User.create({
      first_name: "OtherPlayer",
      email: "other@example.com",
      password: hashedPassword,
      role: "player"
    });

    sport = await Sport.create({
      name: "Badminton",
      description: "Racquet sport",
      active: true
    });

    adminAgent = request.agent(app);
    await adminAgent.post("/login").send({ email: "admin@example.com", password: "pass123" });

    creatorAgent = request.agent(app);
    await creatorAgent.post("/login").send({ email: "creator@example.com", password: "pass123" });

    joinerAgent = request.agent(app);
    await joinerAgent.post("/login").send({ email: "joiner@example.com", password: "pass123" });
  });

  // 1. Notification Model & Validation Tests
  describe("Notification Model & Validations", () => {
    it("1. Should create a valid notification with default read = false", async () => {
      const notif = await Notification.create({
        userId: creatorPlayer.id,
        message: "Test notification message",
        type: "general"
      });

      expect(notif.id).toBeDefined();
      expect(notif.userId).toBe(creatorPlayer.id);
      expect(notif.message).toBe("Test notification message");
      expect(notif.type).toBe("general");
      expect(notif.read).toBe(false);
    });

    it("2. Should fail validation if message exceeds 500 characters", async () => {
      const longMessage = "a".repeat(501);
      await expect(
        Notification.create({
          userId: creatorPlayer.id,
          message: longMessage,
          type: "general"
        })
      ).rejects.toThrow();
    });

    it("3. Should fail if type is invalid enum value", async () => {
      await expect(
        Notification.create({
          userId: creatorPlayer.id,
          message: "Valid message",
          type: "invalid_type"
        })
      ).rejects.toThrow();
    });
  });

  // 2. GET /notifications Route Tests
  describe("GET /notifications", () => {
    it("4. Unauthenticated user should be redirected to login", async () => {
      const res = await request(app).get("/notifications");
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe("/login");
    });

    it("5. Logged-in user sees their notifications ordered DESC", async () => {
      await Notification.create({
        userId: creatorPlayer.id,
        message: "First notification",
        type: "general",
        createdAt: new Date("2026-01-01T10:00:00Z")
      });

      await Notification.create({
        userId: creatorPlayer.id,
        message: "Second notification",
        type: "session_joined",
        createdAt: new Date("2026-01-02T10:00:00Z")
      });

      // Notification for another user (should not appear)
      await Notification.create({
        userId: otherPlayer.id,
        message: "Other user notification",
        type: "general"
      });

      const res = await creatorAgent.get("/notifications");
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain("Second notification");
      expect(res.text).toContain("First notification");
      expect(res.text).not.toContain("Other user notification");
    });
  });

  // 3. POST /notifications/:id/read Route Tests
  describe("POST /notifications/:id/read", () => {
    it("6. Owner can mark individual notification as read", async () => {
      const notif = await Notification.create({
        userId: creatorPlayer.id,
        message: "Unread notice",
        type: "general",
        read: false
      });

      const res = await creatorAgent.post(`/notifications/${notif.id}/read`);
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe("/notifications");

      const updated = await Notification.findByPk(notif.id);
      expect(updated.read).toBe(true);
    });

    it("7. Non-owner cannot mark another user's notification as read", async () => {
      const notif = await Notification.create({
        userId: creatorPlayer.id,
        message: "Creator's notice",
        type: "general",
        read: false
      });

      const res = await joinerAgent.post(`/notifications/${notif.id}/read`);
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe("/notifications");

      const updated = await Notification.findByPk(notif.id);
      expect(updated.read).toBe(false);
    });
  });

  // 4. POST /notifications/read-all Route Tests
  describe("POST /notifications/read-all", () => {
    it("8. Owner can mark all their unread notifications as read", async () => {
      await Notification.create({
        userId: creatorPlayer.id,
        message: "Notice 1",
        type: "general",
        read: false
      });
      await Notification.create({
        userId: creatorPlayer.id,
        message: "Notice 2",
        type: "session_joined",
        read: false
      });
      const otherNotif = await Notification.create({
        userId: otherPlayer.id,
        message: "Other Notice",
        type: "general",
        read: false
      });

      const res = await creatorAgent.post("/notifications/read-all");
      expect(res.statusCode).toBe(302);

      const creatorNotifs = await Notification.findAll({ where: { userId: creatorPlayer.id } });
      expect(creatorNotifs.every((n) => n.read === true)).toBe(true);

      const unreadOther = await Notification.findByPk(otherNotif.id);
      expect(unreadOther.read).toBe(false);
    });
  });

  // 5. Trigger Notifications Tests
  describe("Notification Triggers", () => {
    it("9. Player joining a session triggers notification to creator", async () => {
      const sessionItem = await Session.create({
        sportId: sport.id,
        creatorId: creatorPlayer.id,
        date: futureDate,
        time: futureTime,
        venue: "Court A",
        additionalPlayersNeeded: 3,
        status: "scheduled"
      });

      await joinerAgent.post(`/sessions/${sessionItem.id}/join`);

      const notifs = await Notification.findAll({ where: { userId: creatorPlayer.id } });
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe("session_joined");
      expect(notifs[0].message).toContain("JoinerPlayer joined your badminton session");
    });

    it("10. Player cancelling a session triggers notification to all participants with reason", async () => {
      const sessionItem = await Session.create({
        sportId: sport.id,
        creatorId: creatorPlayer.id,
        date: futureDate,
        time: futureTime,
        venue: "Court A",
        additionalPlayersNeeded: 2,
        status: "scheduled"
      });

      // Joiner joins
      await Participant.create({ sessionId: sessionItem.id, userId: joinerPlayer.id });

      // Creator cancels session with reason
      await creatorAgent.post(`/sessions/${sessionItem.id}/cancel`).send({
        cancellationReason: "Rain expected"
      });

      const notifs = await Notification.findAll({ where: { type: "session_cancelled" } });
      expect(notifs.length).toBe(1);
      expect(notifs[0].userId).toBe(joinerPlayer.id);
      expect(notifs[0].message).toContain("badminton session");
      expect(notifs[0].message).toContain("Reason: Rain expected");
    });

    it("11. Admin cancelling a session triggers notification to participants", async () => {
      const sessionItem = await Session.create({
        sportId: sport.id,
        creatorId: creatorPlayer.id,
        date: futureDate,
        time: futureTime,
        venue: "Court A",
        additionalPlayersNeeded: 2,
        status: "scheduled"
      });

      await Participant.create({ sessionId: sessionItem.id, userId: joinerPlayer.id });

      await adminAgent.post(`/admin/sessions/${sessionItem.id}/cancel`);

      const notifs = await Notification.findAll({
        where: { userId: joinerPlayer.id, type: "session_cancelled" }
      });
      expect(notifs.length).toBe(1);
      expect(notifs[0].message).toContain("has been cancelled");
    });

    it("12. Admin marking session completed triggers notification to participants", async () => {
      const sessionItem = await Session.create({
        sportId: sport.id,
        creatorId: creatorPlayer.id,
        date: futureDate,
        time: futureTime,
        venue: "Court A",
        additionalPlayersNeeded: 2,
        status: "scheduled"
      });

      await Participant.create({ sessionId: sessionItem.id, userId: joinerPlayer.id });

      await adminAgent.post(`/admin/sessions/${sessionItem.id}/complete`);

      const notifs = await Notification.findAll({
        where: { userId: joinerPlayer.id, type: "session_completed" }
      });
      expect(notifs.length).toBe(1);
      expect(notifs[0].message).toContain("has been completed");
    });
  });

  // 6. Unread Badge Middleware Integration Test
  describe("Navbar Unread Notifications Badge", () => {
    it("13. Unread notification count is reflected in res.locals / rendered view", async () => {
      await Notification.create({
        userId: creatorPlayer.id,
        message: "Notice 1",
        type: "general",
        read: false
      });
      await Notification.create({
        userId: creatorPlayer.id,
        message: "Notice 2",
        type: "general",
        read: false
      });

      const res = await creatorAgent.get("/");
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain("Notifications (2)");
    });
  });
});
