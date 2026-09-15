const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { User, Sport, Notification, sequelize } = require("../models");

describe("Admin Sports Management", () => {
  let adminAgent;
  let playerAgent;
  let adminUser;
  let playerUser;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await Notification.destroy({ where: {}, truncate: true });
    await Sport.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });

    const hashedPassword = await bcrypt.hash("pass123", 10);

    adminUser = await User.create({
      first_name: "Admin",
      email: "admin@example.com",
      password: hashedPassword,
      role: "admin"
    });

    playerUser = await User.create({
      first_name: "Player",
      email: "player@example.com",
      password: hashedPassword,
      role: "player"
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

  it("1. Admin can access /admin/sports", async () => {
    const res = await adminAgent.get("/admin/sports");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Manage Sports");
  });

  it("2. Player cannot access /admin/sports", async () => {
    const res = await playerAgent.get("/admin/sports");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  it("3. Unauthenticated user cannot access /admin/sports", async () => {
    const res = await request(app).get("/admin/sports");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("4. Admin can create a sport", async () => {
    const res = await adminAgent.post("/admin/sports").send({
      name: "Basketball",
      description: "Indoor court sport"
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/admin/sports");

    const sport = await Sport.findOne({ where: { name: "Basketball" } });
    expect(sport).not.toBeNull();
    expect(sport.description).toBe("Indoor court sport");
    expect(sport.active).toBe(true);
  });

  it("5. Sport validation rejects an empty name", async () => {
    const res = await adminAgent.post("/admin/sports").send({
      name: "   ",
      description: "No name sport"
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/admin/sports/new");

    const count = await Sport.count();
    expect(count).toBe(0);
  });

  it("6. Duplicate sport name is rejected", async () => {
    await Sport.create({ name: "Cricket", description: "Outdoor sport", active: true });

    const res = await adminAgent.post("/admin/sports").send({
      name: "Cricket",
      description: "Duplicate sport"
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/admin/sports/new");

    const count = await Sport.count({ where: { name: "Cricket" } });
    expect(count).toBe(1);
  });

  it("7. Admin can edit a sport", async () => {
    const sport = await Sport.create({ name: "Tennis", description: "Court sport", active: true });

    const res = await adminAgent.post(`/admin/sports/${sport.id}`).send({
      name: "Table Tennis",
      description: "Indoor table sport"
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/admin/sports");

    const updatedSport = await Sport.findByPk(sport.id);
    expect(updatedSport.name).toBe("Table Tennis");
    expect(updatedSport.description).toBe("Indoor table sport");
  });

  it("8. Admin can activate/deactivate a sport", async () => {
    const sport = await Sport.create({ name: "Badminton", description: "Racket sport", active: true });

    // Deactivate
    const resDeactivate = await adminAgent.post(`/admin/sports/${sport.id}/toggle`);
    expect(resDeactivate.statusCode).toBe(302);
    let updatedSport = await Sport.findByPk(sport.id);
    expect(updatedSport.active).toBe(false);

    // Reactivate
    const resActivate = await adminAgent.post(`/admin/sports/${sport.id}/toggle`);
    expect(resActivate.statusCode).toBe(302);
    updatedSport = await Sport.findByPk(sport.id);
    expect(updatedSport.active).toBe(true);
  });

  it("9. Player cannot POST to create a sport", async () => {
    const res = await playerAgent.post("/admin/sports").send({
      name: "Volleyball",
      description: "Beach or court sport"
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/");

    const count = await Sport.count({ where: { name: "Volleyball" } });
    expect(count).toBe(0);
  });

  it("10. Player cannot POST to edit a sport", async () => {
    const sport = await Sport.create({ name: "Swimming", description: "Water sport", active: true });

    const res = await playerAgent.post(`/admin/sports/${sport.id}`).send({
      name: "Water Polo",
      description: "Team water sport"
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/");

    const unchangedSport = await Sport.findByPk(sport.id);
    expect(unchangedSport.name).toBe("Swimming");
  });
});
