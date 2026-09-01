# SplitEase — Shared Expense Management App

A production-quality Splitwise-style application for tracking shared
expenses among friends, roommates, families, or small teams: create
groups, add expenses with flexible splitting, see who owes whom, and
record settlements — all backed by financially correct, auditable
calculations.

---

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Local Installation](#local-installation)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Backend](#running-the-backend)
- [Running the Frontend](#running-the-frontend)
- [Running Tests](#running-tests)
- [API Overview](#api-overview)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)

---

## Features

- **Authentication** — register/login/logout with JWT, argon2 password hashing, protected routes.
- **Groups** — create groups, invite members by username or email, view membership, leave a group (only once your balance is zero).
- **Expenses** — add expenses with **equal** or **exact-amount** splits, edit and delete (soft-delete) expenses, full split validation.
- **Balance engine** — net balances computed live from expenses + settlements (never cached), plus a deterministic debt-simplification algorithm ("who owes whom").
- **Settlements** — record payments between members; they flow directly into balance calculations.
- **Dashboard** — total owed/owing across all groups, per-group balances, latest 10 activity items.
- **Activity log** — every balance-changing action (expense created/edited/deleted, settlement recorded, member joined/left, group created) is recorded with actor, timestamp, and metadata.
- **Correctness-first money handling** — all amounts stored as integer cents; no floating-point arithmetic anywhere in the financial logic.

## Technology Stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, react-hot-toast.

**Backend:** Node.js, TypeScript, Express, Zod validation, argon2 (password hashing), JWT (jsonwebtoken).

**Database / ORM:** PostgreSQL via Prisma.

**Testing:** Vitest, focused on the financial logic (money utilities, split algorithms, balance simplification).

## Architecture Overview

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full data model, balance
math explanation, trade-offs, and edge-case handling. In short:

- **Source of truth**: `Expense` + `ExpenseSplit` + `Settlement` rows. There is **no stored balance column anywhere** — every balance is derived at read time, which means edits, deletions, and corrections to historical records can never leave a stale/incorrect balance behind.
- **Money**: every amount is an integer number of cents in the database and in all business logic. Decimal strings are only used at the API/UI boundary.
- **Layering**: controllers only validate input and call services; all financial logic (splitting, balance computation, debt simplification) lives in dedicated service modules (`src/services/*`), independently unit-tested.

## Project Structure

```
root/
├── frontend/
│   └── src/
│       ├── api/            # axios calls per resource
│       ├── components/     # shared UI (Navbar, ExpenseForm, Common, ProtectedRoute)
│       ├── context/        # AuthContext
│       ├── pages/          # one file per route
│       ├── types/          # shared TS interfaces
│       └── utils/          # currency formatting
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── controllers/    # thin: validate → call service → respond
│       ├── services/       # all business logic, incl. balance engine
│       ├── routes/
│       ├── middleware/     # auth, group-membership guard, error handler
│       ├── validators/     # Zod schemas
│       ├── utils/          # money.ts (cents conversion, split algorithms), jwt.ts
│       └── tests/          # Vitest unit tests for financial logic
├── README.md
├── ARCHITECTURE.md
└── .env.example (see backend/.env.example and frontend/.env.example)
```

## Local Installation

Prerequisites: Node.js 20+, npm, a PostgreSQL database (local or hosted).

```bash
git clone <this-repo>
cd splitwise

# Backend
cd backend
npm install
cp .env.example .env   # then fill in DATABASE_URL and JWT_SECRET

# Frontend
cd ../frontend
npm install
cp .env.example .env   # defaults to http://localhost:5000/api
```

## Environment Variables

**backend/.env**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign JWTs — use a long random value in production |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `PORT` | API server port (default `5000`) |
| `CLIENT_URL` | Frontend origin, for CORS (default `http://localhost:5173`) |
| `NODE_ENV` | `development` \| `production` \| `test` |

**frontend/.env**

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend API, e.g. `http://localhost:5000/api` |

Never commit real `.env` files — only `.env.example` files are checked in.

## Database Setup

```bash
cd backend
npx prisma migrate dev --name init   # creates tables from schema.prisma
npx prisma generate                  # generates the typed Prisma client
npm run seed                         # optional: seeds 3 demo users + a sample group/expense
```

> **Note:** `prisma generate` needs to download a matching query-engine
> binary the first time it runs, which requires outbound internet
> access to Prisma's binary CDN. If you're behind a restrictive
> firewall/proxy, see Prisma's docs on custom engine mirrors or
> offline installs.

Seeded demo accounts (password `Password123` for all):
- `alice@example.com`
- `bob@example.com`
- `charlie@example.com`

## Running the Backend

```bash
cd backend
npm run dev        # tsx watch, http://localhost:5000
# or, for production:
npm run build
npm start
```

## Running the Frontend

```bash
cd frontend
npm run dev         # http://localhost:5173
# or, for production:
npm run build
npm run preview
```

## Running Tests

```bash
cd backend
npm test            # runs the Vitest suite (money, split, and balance-simplification tests)
```

The test suite specifically verifies:
1. Equal splits always sum exactly to the total (including remainder-cent cases).
2. Exact splits are rejected when they don't sum to the total, contain duplicates, or use non-positive amounts.
3. The debt-simplification algorithm reproduces the two worked examples from the spec, and — as a property test — always fully reconciles arbitrary balanced input.
4. Payer-included-in-participants and payer-not-included scenarios net out correctly.
5. Multiple expenses accumulate correctly across a group.
6. Settlements zero out balances as expected.

## API Overview

All responses follow:
```json
{ "success": true, "data": { ... } }
```
or on error:
```json
{ "success": false, "message": "...", "errors": [] }
```

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/auth/me` | Current user |
| POST | `/api/groups` | Create a group |
| GET | `/api/groups` | List your groups |
| GET | `/api/groups/:groupId` | Group details + members |
| POST | `/api/groups/:groupId/members` | Add a member by username/email |
| DELETE | `/api/groups/:groupId/members/:userId` | Leave/remove a member (blocked if balance ≠ 0) |
| POST | `/api/groups/:groupId/expenses` | Create an expense |
| GET | `/api/groups/:groupId/expenses` | List a group's expenses |
| GET | `/api/expenses/:expenseId` | Get one expense |
| PUT | `/api/expenses/:expenseId` | Edit an expense (recomputes splits) |
| DELETE | `/api/expenses/:expenseId` | Soft-delete an expense |
| GET | `/api/groups/:groupId/balances` | Net balances + simplified debts |
| POST | `/api/groups/:groupId/settlements` | Record a settlement |
| GET | `/api/groups/:groupId/settlements` | List settlements |
| GET | `/api/groups/:groupId/activity` | Activity log (supports `?limit=`) |
| GET | `/api/dashboard` | Aggregated dashboard data |

## Deployment

- **Frontend** → Vercel (or any static host): `npm run build` in `frontend/`, deploy `dist/`. Set `VITE_API_URL` to your deployed backend URL.
- **Backend** → Render or Railway: `npm run build && npm start`. Set all backend env vars in the platform's dashboard; make sure `CLIENT_URL` points at your deployed frontend origin (CORS).
- **Database** → Neon, Supabase, Railway, or Render Postgres. Run `npx prisma migrate deploy` as part of your deploy step (not `migrate dev`, which is interactive/dev-only).

See [ARCHITECTURE.md](./ARCHITECTURE.md#deployment) for more detail on CORS and migration steps.

## Known Limitations

- No email verification or password-reset flow.
- No pagination on expense/settlement/activity lists beyond a simple `limit` param on activity.
- No real-time updates (e.g. websockets) — the frontend relies on query invalidation after mutations.
- No multi-currency support; all amounts are assumed to be a single currency (USD formatting in the UI).
- No file/receipt attachments on expenses.
- Debt simplification uses a greedy largest-creditor/largest-debtor heuristic; it is always correct (zeroes out every balance) but is not guaranteed to produce the mathematically minimal number of transactions in every possible input.
"# splitwise-expense-app" 
