const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { User, sequelize } = require("../models");

describe("Temporary Diagnostic: GET /admin/debug/migrations", () => {
  let adminUser;
  let playerUser;
  let adminAgent;
  let playerAgent;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await User.destroy({ where: {}, truncate: true });

    const hashedPassword = await bcrypt.hash("password123", 10);

    adminUser = await User.create({
      first_name: "AdminUser",
      email: "admin_debug@example.com",
      password: hashedPassword,
      role: "admin"
    });

    playerUser = await User.create({
      first_name: "PlayerUser",
      email: "player_debug@example.com",
      password: hashedPassword,
      role: "player"
    });

    adminAgent = request.agent(app);
    await adminAgent
      .post("/login")
      .send({ email: "admin_debug@example.com", password: "password123" });

    playerAgent = request.agent(app);
    await playerAgent
      .post("/login")
      .send({ email: "player_debug@example.com", password: "password123" });
  });

  it("should redirect unauthenticated users to /login", async () => {
    const res = await request(app).get("/admin/debug/migrations");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("should deny access to non-admin users and redirect to /", async () => {
    const res = await playerAgent.get("/admin/debug/migrations");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  it("should allow admin users and render migration debug info", async () => {
    const res = await adminAgent.get("/admin/debug/migrations");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("[TEMPORARY DIAGNOSTIC]");
    expect(res.text).toContain("20260915000008-update-admin-password.js");
    expect(res.text).toContain("20260915000009-ensure-admin-account.js");
    expect(res.text).toContain("20260915000010-repair-admin-account.js");
  });
});
