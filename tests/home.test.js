const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { User, sequelize } = require("../models");

describe("GET / Homepage", () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("should respond with HTTP 200 and render homepage for logged-out users", async () => {
    const response = await request(app).get("/");
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain("Sports Scheduler");
    expect(response.text).toContain("Welcome to Sports Scheduler");
    expect(response.text).toContain("Log In");
    expect(response.text).toContain("Sign Up");
  });

  it("should render player dashboard for logged-in player", async () => {
    const hashedPassword = await bcrypt.hash("pass123", 10);
    await User.create({
      first_name: "PlayerUser",
      email: "homeplayer@example.com",
      password: hashedPassword,
      role: "player"
    });

    const agent = request.agent(app);
    await agent.post("/login").send({
      email: "homeplayer@example.com",
      password: "pass123"
    });

    const response = await agent.get("/");
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain("Welcome, PlayerUser!");
    expect(response.text).toContain("Player Dashboard");
    expect(response.text).toContain("Browse Sessions");
    expect(response.text).toContain("Create Session");
    expect(response.text).toContain("My Sessions");
    expect(response.text).toContain("My Joined Sessions");
  });

  it("should render admin dashboard for logged-in admin", async () => {
    const hashedPassword = await bcrypt.hash("pass123", 10);
    await User.create({
      first_name: "AdminUser",
      email: "homeadmin@example.com",
      password: hashedPassword,
      role: "admin"
    });

    const agent = request.agent(app);
    await agent.post("/login").send({
      email: "homeadmin@example.com",
      password: "pass123"
    });

    const response = await agent.get("/");
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain("Welcome, AdminUser!");
    expect(response.text).toContain("Admin Dashboard");
    expect(response.text).toContain("Manage Sports");
    expect(response.text).toContain("Manage Sessions");
    expect(response.text).toContain("Reports");
  });
});
