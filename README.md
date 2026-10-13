# Deadline Radar

A focused student planning dashboard for tracking coursework, prioritizing deadlines, and understanding which assignments are becoming risky before they slip.

## Overview

Deadline Radar helps students manage assignments, study sessions, and due dates in one place. It combines a React frontend with an Express API and MongoDB data layer to surface a clear overview of workload, urgency, and time invested.

The app is designed around a simple idea: students should be able to answer three questions quickly:

- What is due soon?
- What is risky right now?
- How much time have I actually spent studying?

## Why it exists

Students often split coursework across notes, calendars, and spreadsheets. That fragmentation makes it hard to see which assignments deserve attention first. Deadline Radar brings those signals together into a single workflow with a simple dashboard, per-assignment tracking, and risk scoring based on deadline pressure, difficulty, and completion progress.

## Features

- Assignment tracking with title, subject, difficulty, due date, hours, completion, tags, and checklist items
- Risk scoring that weights urgency, difficulty, and remaining work
- Prioritized dashboard highlighting overdue and near-term tasks
- Study session logging tied to specific assignments
- Analytics for subject performance, weekly study time, and assignment-level effort
- Secure student accounts with password hashing and cookie-based sessions
- MongoDB-powered data model with real validation and aggregation queries

## Tech stack

- Frontend: React + TypeScript + Vite
- UI: custom CSS and Recharts visualizations
- Backend: Express.js + Node.js
- Persistence: MongoDB + Mongoose
- Auth: bcrypt + signed HTTP-only cookies + JWT-based session flow
- Validation: Zod

## Architecture

```text
Client (React + Vite)
       │
       ├── /auth, /assignments, /study-sessions, /analytics
       ▼
API (Express)
       │
       ├── auth/session validation
       ├── assignment and study-session CRUD
       └── MongoDB aggregation endpoints
       ▼
MongoDB (deadline_radar)
```

## Project structure

```text
.
├── client/                # Vite React client
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── server/                # Express API and MongoDB models
│   ├── src/
│   ├── package.json
│   ├── .env.example
│   └── .env
├── package.json           # Root scripts
├── README.md
├── .gitignore
└── package-lock.json
```

## Risk scoring

Assignments are scored using a transparent formula based on three inputs:

- Deadline pressure
- Difficulty
- Remaining work

The current logic is:

```text
deadline:    >7 days = 5; 4–7 days = 15; 2–3 days = 25; 0–1 day or overdue = 40
difficulty:  Easy = 10; Medium = 20; Hard = 30
remaining:   ((100 - completionPercentage) / 100) * 30
score:       clamp(round(deadline + difficulty + remaining), 0, 100)
```

Risk levels are mapped as follows:

- 0–30: Low
- 31–60: Medium
- 61–100: High
- 100% complete: Completed

## Getting started

### Prerequisites

- Node.js 20+
- npm
- MongoDB 6+ running locally or on MongoDB Atlas

### 1) Install dependencies

From the project root:

```bash
npm install
npm --prefix client install
npm --prefix server install
```

### 2) Configure environment variables

Create the backend environment file:

```bash
cp server/.env.example server/.env
```

Then update `server/.env`:

```dotenv
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/deadline_radar
JWT_SECRET=your_secure_random_string_here
CLIENT_ORIGIN=http://localhost:5173
TZ=Asia/Kolkata
```

Notes:

- `JWT_SECRET` should be a long random string with at least 32 characters.
- If you use Atlas, replace `MONGODB_URI` with your MongoDB connection string.
- Keep credentials in `server/.env` and do not commit them.

### 3) Start the app

From the project root:

```bash
npm run dev
```

This starts:

- API: http://localhost:4000
- Client: http://localhost:5173

### 4) Verify health

Open:

```text
http://localhost:4000/api/health
```

## Usage

1. Create an account or log in.
2. Add assignments with due dates, subjects, and difficulty.
3. Update completion progress and checklist tasks.
4. Log study sessions for each assignment.
5. Use the dashboard and analytics pages to identify what needs attention first.

The app intentionally starts with no seeded demo records; each user workspace is empty until they add their own data.

## API overview

The backend exposes the following primary routes under `/api`:

- `POST /auth/signup` — create account
- `POST /auth/login` — sign in
- `POST /auth/logout` — sign out
- `GET /auth/me` — current user
- `GET /assignments` — fetch filtered assignments
- `POST /assignments` — create assignment
- `PUT /assignments/:id` — update assignment
- `DELETE /assignments/:id` — delete assignment and related sessions
- `GET /study-sessions` — fetch sessions
- `POST /study-sessions` — log a study session
- `PUT /study-sessions/:id` — update a session
- `DELETE /study-sessions/:id` — delete session
- `GET /analytics/dashboard` — overview metrics and urgent items
- `GET /analytics/subjects` — subject-level breakdowns
- `GET /analytics/study-time` — weekly and assignment study totals
- `GET /analytics/checklist` — checklist insights

## Development notes

- The client refreshes dashboard data periodically to keep the workload view current.
- Assignment deletion also removes related study sessions to avoid orphaned records.
- Risk and completion data are recalculated from the latest assignment state whenever the record is saved.
- MongoDB aggregation routes are used for dashboard and reporting summaries.

## Scripts

From the root:

```bash
npm run dev
npm run build
npm test
```

`npm run build` creates the production frontend bundle, and `npm test` runs the backend risk calculation tests.

## License

This project is currently unlicensed. If you plan to share or distribute it, add an explicit license before publication.

## Contributing

Contributions are welcome. If you want to improve the app:

1. Fork the project
2. Create a feature branch
3. Add tests for behavior changes
4. Submit a pull request with a clear description
