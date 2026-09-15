# Sports Scheduler

A web application designed for organizing and scheduling sports activities. It allows administrators to create and manage sports and sessions, while enabling players to browse, create, and join sports sessions.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Templating**: EJS
- **Database**: PostgreSQL, Sequelize ORM
- **Authentication**: Passport.js (Local Strategy), bcrypt, express-session
- **Security & Utilities**: connect-flash, csurf, dotenv
- **Testing**: Jest, Supertest
- **Frontend**: HTML5, CSS3

## Folder Structure

```
sports-scheduler/
├── config/         # Configuration files (database, passport)
├── middleware/     # Custom Express middleware (auth, admin, flash)
├── migrations/     # Sequelize database migrations
├── models/         # Sequelize data models
├── public/         # Static assets (CSS, JS, images)
│   └── css/
│       └── style.css
├── routes/         # Express application routes
│   └── index.js
├── tests/          # Integration and unit tests
│   └── home.test.js
├── views/          # EJS template views
│   └── index.ejs
├── app.js          # Express app configuration
├── server.js       # Application entry point
├── .env.example    # Environment variables sample template
├── .gitignore      # Git ignore definitions
├── package.json    # Project dependencies and scripts
└── README.md       # Project documentation
```

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Copy `.env.example` to `.env` and fill in your PostgreSQL credentials and session secret:
   ```bash
   cp .env.example .env
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```
   Or start in production mode:
   ```bash
   npm start
   ```

4. **Run Tests**
   ```bash
   npm test
   ```
