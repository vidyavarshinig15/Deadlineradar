# Deadline Radar — Smart Assignment Risk Tracker

## Abstract

Deadline Radar is a student productivity dashboard for recording coursework, spotting assignment risk early, and keeping a history of focused study. It is a full-stack mini project built with React, TypeScript, Express, MongoDB and Mongoose. Students create an account and their dashboard, reports and charts use only that account's saved MongoDB records. The app does not create demo assignments or sessions.

## Problem statement and objectives

Students often track due dates, work progress and study time in separate places. Deadline Radar keeps these in one view so a student can see what is urgent and why. Its objectives are to:

- Manage assignments, progress, due dates, effort estimates and embedded checklist tasks.
- Calculate explainable risk scores and prioritize work.
- Record study sessions without treating time spent as automatic assignment progress.
- Demonstrate MongoDB documents, embedded data, references, indexes, validation, CRUD and aggregation.

## Requirements

- Node.js 20 or newer and npm.
- MongoDB 6 or newer (a local MongoDB server or an Atlas connection string).
- A modern browser.
- Hardware: any computer able to run Node.js and MongoDB locally; 4 GB RAM is recommended.

## Architecture

```text
React + TypeScript + Vite (localhost:5173)
            │ /api proxy
            ▼
Express REST API (localhost:4000)
            │ Mongoose
            ▼
MongoDB database: deadline_radar
```

The React client contains the responsive dashboard, assignment and checklist forms, study-session tracker, analytics, account creation/login and profile form. Express validates requests, hashes account passwords, uses a signed HTTP-only cookie for login sessions, and scopes all student data queries to the authenticated account. Dashboard data refreshes every 15 seconds and after app changes.

## MongoDB schema and relationships

The database contains three collections. MongoDB stores each record as a BSON document. Each student account has its own referenced assignments and study sessions.

**students** — one account per registered student; the password is stored only as a bcrypt hash and is never returned by the API.

```json
{
  "_id": "ObjectId",
  "name": "Your name",
  "email": "student@example.edu",
  "passwordHash": "bcrypt hash (never returned)",
  "department": "Computer Science Engineering",
  "semester": 8,
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

**assignments** — a `studentId` reference to `students`; `checklist` is embedded because those task items belong to one assignment and are usually read/updated with it.

```json
{
  "_id": "ObjectId",
  "studentId": "ObjectId -> students",
  "title": "Cloud Security Report",
  "subject": "Cloud Computing",
  "description": "Write and review the report.",
  "dueDate": "Date",
  "difficulty": "Hard",
  "estimatedHours": 10,
  "completionPercentage": 20,
  "status": "In Progress",
  "riskScore": 94,
  "riskLevel": "High",
  "riskExplanation": "High risk: This hard assignment is due tomorrow and is 20% complete.",
  "tags": ["cloud-computing"],
  "checklist": [{ "_id": "ObjectId", "text": "Draft findings", "completed": false, "createdAt": "Date" }],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

**studySessions** — references both student and assignment. Deleting an assignment first deletes its related sessions to avoid dangling references.

```json
{
  "_id": "ObjectId",
  "studentId": "ObjectId -> students",
  "assignmentId": "ObjectId -> assignments",
  "sessionDate": "Date",
  "durationMinutes": 45,
  "notes": "Reviewed lecture notes.",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

Mongoose creates indexes for student, due date, status, risk level, assignment reference and common compound queries. Indexes make common filtering and sorting faster, at the cost of additional storage and update work.

## Risk score

The reusable function in `server/src/utils/risk.js` adds three factors and rounds the result:

```text
deadline:    >7 days = 5; 4–7 days = 15; 2–3 days = 25; 0–1 day or overdue = 40
difficulty:  Easy = 10; Medium = 20; Hard = 30
remaining:   ((100 − completion percentage) / 100) × 30
score:       clamp(round(deadline + difficulty + remaining), 0, 100)
```

Scores 0–30 are Low, 31–60 Medium, and 61–100 High. Completed assignments always have score 0 and level `Completed`. Due-day comparisons use local calendar dates (the configured process timezone, default `Asia/Kolkata`); an assignment later today has zero days remaining. An already-passed due timestamp is overdue and receives 40 deadline points. The UI formats dates in the browser’s local timezone; set the browser and server timezone consistently for a classroom demo.

Example: a Hard assignment due tomorrow at 20% completion scores `40 + 30 + ((100 - 20) / 100 × 30) = 94`, hence High risk.

## MongoDB concepts in the running project

- CRUD: profile, assignment, and study-session endpoints create/read/update/delete MongoDB documents.
- Embedded documents: assignment checklist items can be added, checked off, and removed without a separate collection.
- References: `studentId` and `assignmentId` hold ObjectIds; the session list uses Mongoose `populate()`.
- `$match`: dashboard and reports scope records to the authenticated student and selected subject.
- `$project`: reports select fields and derive `studyMinutes`; weekly study totals derive hours.
- `$group`: status/risk totals, subject summaries and study totals.
- `$sort`: report rows, subjects, recent sessions and urgent assignments are sorted in MongoDB.
- `$unwind`: `/api/analytics/checklist` expands embedded checklist items before grouping.
- `$facet`: `/api/analytics/dashboard` calculates status counts, risk counts, subject summaries, urgent records and totals from one matched assignment set.
- `$lookup`: `/api/analytics/subjects` joins assignments to sessions; study-time results join sessions back to assignment documents.
- Date queries: assignment filtering supports upcoming seven-day and overdue dates.
- Validation and errors: Zod validates REST payloads; Mongoose validates stored document shapes; centralized middleware returns useful HTTP errors.

Example dashboard pipeline shape:

```js
[
  { $match: { studentId } },
  { $facet: {
    statusCounts: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
    riskCounts: [{ $group: { _id: "$riskLevel", count: { $sum: 1 } } }],
    subjects: [
      { $group: { _id: "$subject", count: { $sum: 1 }, estimatedHours: { $sum: "$estimatedHours" } } },
      { $sort: { estimatedHours: -1 } }
    ],
    urgent: [
      { $match: { status: { $ne: "Completed" } } },
      { $sort: { riskScore: -1, dueDate: 1 } },
      { $limit: 5 },
      { $project: { title: 1, dueDate: 1, riskScore: 1, riskLevel: 1 } }
    ]
  } }
]
```

## API endpoints

All routes are prefixed with `/api`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/signup` | Create a student account, hash password and start a session |
| POST | `/auth/login` | Verify credentials and start a session |
| GET | `/auth/me` | Return the currently signed-in student |
| POST | `/auth/logout` | Clear the login session cookie |
| GET / PUT | `/students/me` | Read/update the signed-in student profile |
| GET | `/assignments` | List; supports `search`, `status`, `subject`, `difficulty`, `riskLevel`, `time=overdue\|upcoming`, `sort=dueDate\|progress\|risk` |
| GET / POST | `/assignments` | Read list/create assignment |
| GET / PUT / DELETE | `/assignments/:id` | Read/update/delete; assignment delete also removes its sessions |
| GET / POST | `/study-sessions` | List/create sessions |
| PUT / DELETE | `/study-sessions/:id` | Update/delete a session |
| GET | `/analytics/dashboard` | Multi-branch `$facet` dashboard aggregation and overdue count |
| GET | `/analytics/subjects?subject=...` | Subject report joined to study sessions |
| GET | `/analytics/study-time` | Weekly and per-assignment study aggregation |
| GET | `/analytics/checklist` | `$unwind` checklist summary by subject |
| GET | `/health` | API/database readiness |

## Install and run

1. Choose a MongoDB connection:

   - **Local MongoDB:** start your MongoDB service. For a manually started local server:

   ```sh
   mkdir -p /tmp/deadline-radar-mongo
   mongod --dbpath /tmp/deadline-radar-mongo --bind_ip 127.0.0.1 --port 27017
   ```

   Keep that terminal open. The local database files go under `/tmp/deadline-radar-mongo`.
   - **MongoDB Atlas:** create a free cluster, create a database user, allow your current IP in Network Access, then copy the Node.js connection URI. Replace the username, password and database name in the URI; URL-encode special characters in the password.
2. Configure the backend, from the project root:

   ```sh
   cp server/.env.example server/.env
   ```

   Edit `server/.env`:

   ```dotenv
   MONGODB_URI=mongodb://127.0.0.1:27017/deadline_radar
   JWT_SECRET=<a private random string of at least 32 characters>
   CLIENT_ORIGIN=http://localhost:5173
   TZ=Asia/Kolkata
   ```

   For Atlas, replace only `MONGODB_URI` with the Atlas URI, for example `mongodb+srv://<db-user>:<url-encoded-password>@<cluster-host>/deadline_radar?retryWrites=true&w=majority`. Generate a local signing secret with `openssl rand -hex 32`. Keep both the URI and secret in the ignored `server/.env`; never put them in frontend code or commit them.
3. Install and launch from the project root:

   ```sh
   npm install
   npm --prefix client install
   npm run dev
   ```

4. Open <http://localhost:5173>, create an account, and add your own assignments and study sessions. A new account intentionally starts empty; nothing is seeded or shown as sample data. Records remain in MongoDB when you close or restart the app. The API health endpoint is <http://localhost:4000/api/health>.

To build the frontend, use `npm run build`. To run risk tests, use `npm test`.

## Live data and existing records

Every assignment, study session and dashboard statistic is read from the configured MongoDB database. A signed-in user's requests are isolated by their student ObjectId; newly registered accounts see an empty dashboard until they add their own records. The browser refreshes server data every 15 seconds, and mutations refresh it immediately. The former demo-seed script has been removed. Any records created by an older version of the project remain in MongoDB but are not exposed to new accounts; do not drop the database unless you intentionally want to delete all stored records.

## Screenshots

Add screenshots of the dashboard, assignments and analytics here after running the local application:

- `docs/screenshots/dashboard.png` — Dashboard
- `docs/screenshots/assignments.png` — Assignment list and checklist
- `docs/screenshots/analytics.png` — Analytics and report

## Limitations and future enhancements

This is an educational local application with account login but no email verification, password reset, recurring tasks, reminders or deployment configuration. Study time is deliberately independent from completion. Future work could add email verification, password recovery, notifications, accessibility/user-preference settings and stronger integration tests against a disposable MongoDB database.

## Conclusion

Deadline Radar demonstrates how a document-oriented database can combine embedded checklist data with referenced student and study-session records. It turns those records into explainable risk indicators and MongoDB aggregation reports in a usable student dashboard.

## Viva questions (quick review)

1. **Why MongoDB?** Its flexible BSON documents suit assignment records with embedded checklists while still supporting indexed queries and aggregation.
2. **What does `$group` do?** It groups documents by a key and calculates values such as counts, sums or averages.
3. **What does `$project` do?** It selects, excludes or computes fields in an aggregation result.
4. **What does `$facet` do?** It runs multiple sub-pipelines over the same input set and returns each result branch together.
5. **What does `$lookup` do?** It joins matching documents from another collection into an array.
6. **What does `$unwind` do?** It emits one pipeline document per array element.
7. **Why embed checklists?** Checklist items belong to one assignment and are read and updated together.
8. **Why use references?** Students and study sessions are separate entities; references avoid duplicating their full data.
9. **Why create indexes?** They speed up commonly filtered/sorted fields but need storage and add write overhead.
10. **What is Mongoose?** An ODM that provides schemas, casting, validation, models and MongoDB access for Node.js.
11. **What is an ObjectId?** MongoDB’s standard BSON identifier type used for document IDs and references.
12. **How is risk calculated?** Deadline proximity (up to 40) + difficulty (up to 30) + remaining work (up to 30).
13. **What happens when an assignment is deleted?** Its related study sessions are deleted first to prevent orphaned references.
14. **How are invalid requests handled?** Zod rejects malformed payloads, Mongoose applies schema validation, and middleware maps errors to HTTP responses.
15. **Does study time change completion?** No. Study duration is logged independently; the student changes completion manually.
