const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { User, Notification, sequelize } = require("../models");

describe("Authentication & Authorization System", () => {
  beforeAll(async () => {
    // Sync in-memory SQLite database for testing
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clear Users and Notifications table before each test
    await Notification.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });
  });

  it("1. should load the signup page", async () => {
    const res = await request(app).get("/signup");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Sign Up");
  });

  it("2. should load the login page", async () => {
    const res = await request(app).get("/login");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Log In");
  });

  it("3. should allow valid player signup and redirect to login", async () => {
    const res = await request(app).post("/signup").send({
      first_name: "PlayerOne",
      email: "player1@example.com",
      password: "password123",
      confirmPassword: "password123"
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");

    const user = await User.findOne({ where: { email: "player1@example.com" } });
    expect(user).not.toBeNull();
    expect(user.first_name).toBe("PlayerOne");
    expect(user.role).toBe("player");
  });

  it("4. should hash password with bcrypt and NOT store plain text", async () => {
    const rawPassword = "secretPassword123";
    await request(app).post("/signup").send({
      first_name: "SecureUser",
      email: "secure@example.com",
      password: rawPassword,
      confirmPassword: rawPassword
    });

    const user = await User.findOne({ where: { email: "secure@example.com" } });
    expect(user.password).not.toBe(rawPassword);
    expect(user.password.startsWith("$2")).toBe(true);
    const isMatch = await bcrypt.compare(rawPassword, user.password);
    expect(isMatch).toBe(true);
  });

  it("5. should reject duplicate email during signup", async () => {
    // Create initial user
    await User.create({
      first_name: "Existing",
      email: "duplicate@example.com",
      password: await bcrypt.hash("pass123", 10),
      role: "player"
    });

    // Attempt signup with same email
    const res = await request(app).post("/signup").send({
      first_name: "NewUser",
      email: "duplicate@example.com",
      password: "pass12345",
      confirmPassword: "pass12345"
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/signup");

    const usersCount = await User.count({ where: { email: "duplicate@example.com" } });
    expect(usersCount).toBe(1);
  });

  it("6. should reject invalid login credentials", async () => {
    await User.create({
      first_name: "TestUser",
      email: "test@example.com",
      password: await bcrypt.hash("correctPass", 10),
      role: "player"
    });

    const res = await request(app).post("/login").send({
      email: "test@example.com",
      password: "wrongPassword"
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("7. should allow valid login and create authenticated session", async () => {
    await User.create({
      first_name: "TestUser",
      email: "valid@example.com",
      password: await bcrypt.hash("correctPass", 10),
      role: "player"
    });

    const agent = request.agent(app);
    const res = await agent.post("/login").send({
      email: "valid@example.com",
      password: "correctPass"
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/");

    // Verify authenticated session access to homepage
    const homeRes = await agent.get("/");
    expect(homeRes.statusCode).toBe(200);
    expect(homeRes.text).toContain("Welcome, TestUser!");
  });

  it("8. should destroy session on logout", async () => {
    await User.create({
      first_name: "TestUser",
      email: "logout@example.com",
      password: await bcrypt.hash("correctPass", 10),
      role: "player"
    });

    const agent = request.agent(app);
    await agent.post("/login").send({
      email: "logout@example.com",
      password: "correctPass"
    });

    const logoutRes = await agent.post("/logout");
    expect(logoutRes.statusCode).toBe(302);
    expect(logoutRes.headers.location).toBe("/login");

    const homeRes = await agent.get("/");
    expect(homeRes.text).toContain("Please log in or sign up");
  });

  it("9. should redirect unauthenticated users from protected routes", async () => {
    const res = await request(app).get("/protected");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("10. should prevent players from accessing admin-only routes", async () => {
    await User.create({
      first_name: "PlayerUser",
      email: "player@example.com",
      password: await bcrypt.hash("pass123", 10),
      role: "player"
    });

    const agent = request.agent(app);
    await agent.post("/login").send({
      email: "player@example.com",
      password: "pass123"
    });

    const res = await agent.get("/admin-dashboard");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/");
  });
});
