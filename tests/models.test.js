const { User, Sport, Session, Participant, sequelize } = require("../models");

describe("Sequelize Models & Associations", () => {
  beforeAll(async () => {
    // Synchronize database schema for SQLite in-memory test environment
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("should load all models correctly", () => {
    expect(User).toBeDefined();
    expect(Sport).toBeDefined();
    expect(Session).toBeDefined();
    expect(Participant).toBeDefined();
  });

  it("should define correct model associations", () => {
    // User associations
    expect(User.associations.createdSessions).toBeDefined();
    expect(User.associations.participations).toBeDefined();

    // Sport associations
    expect(Sport.associations.sessions).toBeDefined();

    // Session associations
    expect(Session.associations.sport).toBeDefined();
    expect(Session.associations.creator).toBeDefined();
    expect(Session.associations.participants).toBeDefined();

    // Participant associations
    expect(Participant.associations.session).toBeDefined();
    expect(Participant.associations.user).toBeDefined();
  });

  it("should validate User model fields", async () => {
    await expect(
      User.create({
        first_name: "",
        email: "invalid-email",
        password: "",
        role: "player"
      })
    ).rejects.toThrow();
  });

  it("should validate Session model fields", async () => {
    await expect(
      Session.create({
        sportId: 1,
        creatorId: 1,
        date: "2026-10-01",
        time: "10:00",
        venue: "Central Park",
        additionalPlayersNeeded: -1
      })
    ).rejects.toThrow();
  });

  it("should successfully create and associate records in database", async () => {
    const user = await User.create({
      first_name: "Admin",
      email: "admin@example.com",
      password: "hashedpassword123",
      role: "admin"
    });

    const sport = await Sport.create({
      name: "Football",
      description: "Outdoor football match",
      active: true
    });

    const session = await Session.create({
      sportId: sport.id,
      creatorId: user.id,
      date: "2026-10-15",
      time: "17:00",
      venue: "Community Turf",
      additionalPlayersNeeded: 4,
      status: "scheduled"
    });

    const participant = await Participant.create({
      sessionId: session.id,
      userId: user.id
    });

    expect(user.id).toBeDefined();
    expect(sport.id).toBeDefined();
    expect(session.id).toBeDefined();
    expect(participant.id).toBeDefined();
    expect(session.additionalPlayersNeeded).toBe(4);
  });
});
