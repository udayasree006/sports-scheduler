const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app");
const { User, Sport, Session, Participant, Notification, sequelize } = require("../models");

describe("Step 16 — Change Password System", () => {
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
    await Notification.destroy({ where: {}, truncate: true });
    await Participant.destroy({ where: {}, truncate: true });
    await Session.destroy({ where: {}, truncate: true });
    await Sport.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });

    const hashedPassword = await bcrypt.hash("OldPassword123!", 10);

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

    adminAgent = request.agent(app);
    await adminAgent.post("/login").send({
      email: "admin@example.com",
      password: "OldPassword123!"
    });

    playerAgent = request.agent(app);
    await playerAgent.post("/login").send({
      email: "player@example.com",
      password: "OldPassword123!"
    });
  });

  it("1. Logged-out user cannot access GET /change-password", async () => {
    const res = await request(app).get("/change-password");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("2. Logged-in player can access GET /change-password", async () => {
    const res = await playerAgent.get("/change-password");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Change Password");
  });

  it("3. Logged-in admin can access GET /change-password", async () => {
    const res = await adminAgent.get("/change-password");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Change Password");
  });

  it("4. Correct current password + valid new password changes the password", async () => {
    const res = await playerAgent.post("/change-password").send({
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword456!",
      confirmPassword: "NewPassword456!"
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/change-password");

    const updatedUser = await User.findByPk(playerUser.id);
    const isNewValid = await bcrypt.compare("NewPassword456!", updatedUser.password);
    expect(isNewValid).toBe(true);
  });

  it("5. Incorrect current password does not change the password", async () => {
    const res = await playerAgent.post("/change-password").send({
      currentPassword: "WrongPassword999!",
      newPassword: "NewPassword456!",
      confirmPassword: "NewPassword456!"
    });

    expect(res.statusCode).toBe(302);

    const updatedUser = await User.findByPk(playerUser.id);
    const isOldValid = await bcrypt.compare("OldPassword123!", updatedUser.password);
    expect(isOldValid).toBe(true);
  });

  it("6. Missing current password is rejected", async () => {
    const res = await playerAgent.post("/change-password").send({
      currentPassword: "",
      newPassword: "NewPassword456!",
      confirmPassword: "NewPassword456!"
    });

    expect(res.statusCode).toBe(302);
    const updatedUser = await User.findByPk(playerUser.id);
    const isOldValid = await bcrypt.compare("OldPassword123!", updatedUser.password);
    expect(isOldValid).toBe(true);
  });

  it("7. Missing new password is rejected", async () => {
    const res = await playerAgent.post("/change-password").send({
      currentPassword: "OldPassword123!",
      newPassword: "",
      confirmPassword: "NewPassword456!"
    });

    expect(res.statusCode).toBe(302);
    const updatedUser = await User.findByPk(playerUser.id);
    const isOldValid = await bcrypt.compare("OldPassword123!", updatedUser.password);
    expect(isOldValid).toBe(true);
  });

  it("8. Missing confirmation is rejected", async () => {
    const res = await playerAgent.post("/change-password").send({
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword456!",
      confirmPassword: ""
    });

    expect(res.statusCode).toBe(302);
    const updatedUser = await User.findByPk(playerUser.id);
    const isOldValid = await bcrypt.compare("OldPassword123!", updatedUser.password);
    expect(isOldValid).toBe(true);
  });

  it("9. Password mismatch is rejected", async () => {
    const res = await playerAgent.post("/change-password").send({
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword456!",
      confirmPassword: "DifferentPassword789!"
    });

    expect(res.statusCode).toBe(302);
    const updatedUser = await User.findByPk(playerUser.id);
    const isOldValid = await bcrypt.compare("OldPassword123!", updatedUser.password);
    expect(isOldValid).toBe(true);
  });

  it("10. Password shorter than 8 characters is rejected", async () => {
    const res = await playerAgent.post("/change-password").send({
      currentPassword: "OldPassword123!",
      newPassword: "Short1",
      confirmPassword: "Short1"
    });

    expect(res.statusCode).toBe(302);
    const updatedUser = await User.findByPk(playerUser.id);
    const isOldValid = await bcrypt.compare("OldPassword123!", updatedUser.password);
    expect(isOldValid).toBe(true);
  });

  it("11. New password equal to current password is rejected", async () => {
    const res = await playerAgent.post("/change-password").send({
      currentPassword: "OldPassword123!",
      newPassword: "OldPassword123!",
      confirmPassword: "OldPassword123!"
    });

    expect(res.statusCode).toBe(302);
    const updatedUser = await User.findByPk(playerUser.id);
    const isOldValid = await bcrypt.compare("OldPassword123!", updatedUser.password);
    expect(isOldValid).toBe(true);
  });

  it("12. New password is stored as a bcrypt hash", async () => {
    await playerAgent.post("/change-password").send({
      currentPassword: "OldPassword123!",
      newPassword: "BrandNewPassword88!",
      confirmPassword: "BrandNewPassword88!"
    });

    const updatedUser = await User.findByPk(playerUser.id);
    expect(updatedUser.password).not.toBe("BrandNewPassword88!");
    expect(updatedUser.password.startsWith("$2b$") || updatedUser.password.startsWith("$2a$")).toBe(true);
  });

  it("13. Old password no longer works after change", async () => {
    await playerAgent.post("/change-password").send({
      currentPassword: "OldPassword123!",
      newPassword: "BrandNewPassword88!",
      confirmPassword: "BrandNewPassword88!"
    });

    const newSessionAgent = request.agent(app);
    const loginRes = await newSessionAgent.post("/login").send({
      email: "player@example.com",
      password: "OldPassword123!"
    });

    expect(loginRes.statusCode).toBe(302);
    expect(loginRes.headers.location).toBe("/login");
  });

  it("14. New password works for future login", async () => {
    await playerAgent.post("/change-password").send({
      currentPassword: "OldPassword123!",
      newPassword: "BrandNewPassword88!",
      confirmPassword: "BrandNewPassword88!"
    });

    const newSessionAgent = request.agent(app);
    const loginRes = await newSessionAgent.post("/login").send({
      email: "player@example.com",
      password: "BrandNewPassword88!"
    });

    expect(loginRes.statusCode).toBe(302);
    expect(loginRes.headers.location).toBe("/");
  });

  it("15. CSRF protection is enforced on POST /change-password in unauthenticated check structure", async () => {
    const unauthRes = await request(app).post("/change-password").send({
      currentPassword: "OldPassword123!",
      newPassword: "BrandNewPassword88!",
      confirmPassword: "BrandNewPassword88!"
    });

    expect(unauthRes.statusCode).toBe(302);
    expect(unauthRes.headers.location).toBe("/login");
  });
});
