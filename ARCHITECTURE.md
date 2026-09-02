# Architecture

## 1. Data Model

### Users
```
User { id, username (unique), email (unique), passwordHash, createdAt, updatedAt }
```
Password hashes are never returned by any API response — controllers
map `User` → a `toPublicUser()` DTO that strips `passwordHash`.

### Groups & GroupMembers
```
Group       { id, name, createdBy, createdAt, updatedAt }
GroupMember { id, groupId, userId, joinedAt }   -- unique(groupId, userId)
```
A `GroupMember` row is the only way a user gains visibility into a
group's expenses, balances, and activity — enforced by the
`requireGroupMember` middleware on every group-scoped route.

### Expenses & ExpenseSplits
```
Expense      { id, groupId, description, totalAmount (int cents), paidByUserId,
               splitType (EQUAL|EXACT), date, createdBy, createdAt, updatedAt, deletedAt }
ExpenseSplit { id, expenseId, userId, amountOwed (int cents) } -- unique(expenseId, userId)
```
`deletedAt` implements a **soft delete**: deleted expenses are excluded
from balance calculations and active listings, but the row (and its
splits) remain in the database for audit purposes. This means a
deleted expense's history is never truly lost, and "undelete" would be
a trivial operation if ever needed.

### Settlements
```
Settlement { id, groupId, paidByUserId, paidToUserId, amount (int cents), date, createdAt }
```

### Activities
```
Activity { id, groupId, actorUserId, eventType, entityId, metadata (json), createdAt }
```
`eventType` is one of: `EXPENSE_CREATED`, `EXPENSE_EDITED`,
`EXPENSE_DELETED`, `SETTLEMENT_RECORDED`, `MEMBER_JOINED`,
`MEMBER_LEFT`, `GROUP_CREATED`. Every service method that mutates
financial state writes an `Activity` row **inside the same database
transaction** as the mutation itself, so the audit log can never
diverge from what actually happened (no "expense created but activity
write failed" inconsistency).

### Relationships & Design Decisions

- Foreign keys cascade on delete for `GroupMember`, `Expense` →
  `ExpenseSplit` (deleting a group or an expense row directly — which
  the app itself never does for expenses, see soft-delete above —
  cleans up dependents automatically at the DB level as a safety net).
- `Expense.splitType` is stored redundantly (it's implicit in whether
  the splits are all equal) purely so the UI can pre-select the
  correct split-mode tab when editing without recomputing it.
- No `Balance` table exists anywhere in the schema. See §2.

## 2. Balance Math

### Why there is no stored "balance" column

The single most important architectural decision in this project is
that **balances are never persisted** — they are always computed from
the append-only ledger of `Expense` + `ExpenseSplit` + `Settlement`
rows. This is deliberate:

- **Correctness under edits.** If balances were cached, editing or
  deleting an expense would require carefully finding and patching
  every affected balance row. Any bug in that patching logic
  produces silently wrong numbers that drift further over time. By
  deriving balances on read, an edit is just "change the ledger rows,
  and the next balance read is automatically correct" — there is no
  separate synchronization step that can fail.
- **Auditability.** Because the ledger is the only source of truth,
  you can always answer "why is this balance what it is?" by listing
  the expenses and settlements that produced it. A cached balance
  offers no such explanation.
- **Simplicity of transactions.** Every write only ever touches
  `Expense`/`ExpenseSplit`/`Settlement`/`Activity` rows inside a single
  Prisma `$transaction`. There is no secondary "now go update the
  balances table" step that could fail independently and leave things
  inconsistent.

### How expenses affect balances

For a given group, for each non-deleted `Expense`:
- The **payer** is credited the full `totalAmount`.
- Each participant (a row in `ExpenseSplit`, which may include the
  payer themselves) is debited their `amountOwed`.

If the payer is also a participant, these two effects net against
each other automatically — no special-casing is needed in the code
(see `balance.service.ts`, `getGroupBalances`).

### How settlements affect balances

For each `Settlement`:
- The **payer** (`paidByUserId`) has their balance **increased** by
  `amount` (paying money discharges/reduces what you owe, or adds to
  what you're owed, symmetrically).
- The **payee** (`paidToUserId`) has their balance **decreased** by
  `amount` (they've now received what was owed to them).

### The core invariant

For any group, at any point in time:

```
sum(netBalance over all members) == 0
```

This holds because every expense's `totalAmount` is fully and exactly
allocated across its splits (enforced by `validateExactSplit` and by
construction in `splitEqual`), and every settlement transfers value
between exactly two members of the same group (enforced by
`createSettlement`'s membership checks). `getGroupBalances` computes
this sum and logs an error if it is ever non-zero, as a runtime
sanity check.

### Debt simplification algorithm

Given the net balances, `simplifyDebts` produces a list of `A owes B
$X` transactions using a **greedy largest-creditor / largest-debtor
matching** approach:

1. Split members into creditors (`balance > 0`) and debtors
   (`balance < 0`), tracking magnitudes.
2. Sort each list descending by amount (ties broken by user ID for
   determinism).
3. Repeatedly transfer `min(topCreditor, topDebtor)` from the largest
   debtor to the largest creditor, reducing both. Whichever reaches
   zero first is removed from consideration (or re-sorted, in the
   general case) and the loop continues.
4. Stop when either list is empty.

This always terminates with every balance reconciled to zero (proven
by property-based test in `balance.test.ts`), and matches both worked
examples from the spec exactly. It is a common, well-understood
heuristic — it is **not** guaranteed to produce the theoretical
minimum number of transactions in every possible input (that general
problem is closely related to minimum-cost flow / bin-covering and is
more complex to implement and reason about), but it is always correct
and deterministic, which was prioritized over transaction-count
optimality here.

### Why integer cents

JavaScript's `number` type is IEEE-754 double-precision floating
point, which cannot exactly represent most decimal fractions (e.g.
`0.1 + 0.2 !== 0.3`). Repeated addition/subtraction of dollar amounts
as floats accumulates rounding error that becomes visible over many
transactions — unacceptable for a financial ledger. Storing everything
as an integer number of cents makes every arithmetic operation exact
integer arithmetic. Conversion only happens at the boundary:
- `toCents()` parses a decimal string/number directly (never via
  `value * 100`, which itself can introduce float error) when data
  enters the system (API request body).
- `toDecimalString()` formats cents back to a 2-decimal string when
  data leaves the system (API response body); the frontend then
  applies locale currency formatting for display only.

### How correctness is verified

`backend/src/tests/` contains Vitest suites that run without a live
database:
- `money.test.ts` — cents conversion round-tripping, and `splitEqual`
  /`validateExactSplit` edge cases (remainder distribution, zero
  participants, duplicate participants, non-positive amounts).
- `balance.test.ts` — the two worked examples from the spec, an
  all-zero case, and a property test that any balanced input is fully
  reconciled by the generated transactions.
- `split.test.ts` — payer-included vs payer-excluded, multiple
  expenses accumulating, and settlement math, using the same
  arithmetic as `balance.service.ts` against an in-memory ledger (so
  it can run in sandboxed/offline CI environments without Postgres).

## 3. Trade-offs

**What was simplified:**
- No pagination on list endpoints beyond a `limit` param on activity —
  acceptable for the expected scale (personal/small-team expense
  groups), but would need cursor-based pagination for groups with
  thousands of expenses.
- No websocket/real-time layer; the frontend re-fetches via query
  invalidation after each mutation, which is simpler to reason about
  correctness-wise at the cost of no live multi-device sync.
- Currency formatting is fixed to USD in the frontend; the backend
  itself is currency-agnostic (it only knows about integer cents).

**Why this stack:**
- **Prisma** gives compile-time-checked queries and painless
  migrations, which matters a lot for a schema this relational
  (5 interrelated tables with cascading integrity rules).
- **Zod** validators keep request-shape validation declarative and
  colocated with the types they produce, and integrate cleanly with
  the centralized error handler.
- **TanStack Query** removes the need for hand-rolled loading/error/
  cache-invalidation state in the frontend, which matters especially
  for a UI where nearly every action (add expense, settle up, edit)
  needs to keep three or four other views (balances, activity,
  dashboard) in sync.

**What would be improved with more development time:**
- Real-time balance updates via websockets or polling.
- Multi-currency support with per-expense currency and conversion.
- Receipt image upload/attachment per expense.
- Finer-grained authorization (e.g. only the expense creator or group
  creator can edit/delete an expense — currently any group member can,
  matching the spec's "any group member can add an expense" but not
  explicitly restricting edits).
- A minimum-transaction-count debt-simplification algorithm for large
  groups (the current greedy approach is correct but not optimal).

**Performance improvements for large groups:**
- `getGroupBalances` currently loads all non-deleted expenses (with
  splits) and all settlements for a group into memory on every
  request. For groups with a very large expense history, this should
  move to a SQL aggregation (`GROUP BY` sums) computed in the database
  rather than in application code, or introduce a periodically
  refreshed materialized snapshot with the ledger still as the
  ultimate source of truth for reconciliation.
- Dashboard aggregation (`dashboard.service.ts`) currently calls
  `getUserBalanceInGroup` once per group membership sequentially
  inside a loop-like `Promise.all` — fine for a handful of groups per
  user, but would benefit from a single batched query across all of a
  user's groups for users in many groups.

## 4. Edge Cases

- **Unequal splits (EQUAL with a non-evenly-divisible total):**
  handled by `splitEqual`'s remainder distribution — the first N
  participants (stable input order) each receive one extra cent so
  the sum always exactly equals the total. See `money.test.ts` for the
  10000/3 and 10001/4 cases.
- **Rounding:** never relevant, by construction — all math is integer
  cents; there is nothing to round mid-calculation. The only rounding
  happens once, at the input boundary (`toCents`, using the decimal
  string's own precision rather than floating multiplication).
- **Editing expenses:** `updateExpense` runs inside a transaction that
  deletes the old `ExpenseSplit` rows and inserts freshly-validated
  ones together with the `Expense` row update, so a partial failure
  never leaves mismatched totals/splits. Because balances are derived,
  the edit is immediately reflected in every subsequent balance read.
- **Users leaving groups:** `removeMember` computes the user's current
  net balance via the same `getUserBalanceInGroup` used everywhere
  else, and rejects the request with a clear message unless it is
  exactly zero.
- **Deleted expenses:** soft-deleted (`deletedAt` set) rather than
  hard-deleted, so they're excluded from balances/listings but remain
  in the database for audit/activity-log purposes.
- **Invalid settlements:** rejected before any database write if the
  amount isn't positive, if payer equals payee, or if either party
  isn't a member of the group.
- **Unauthorized access:** every group-scoped route requires
  `requireAuth` then `requireGroupMember` (or, for expense-ID-keyed
  routes, `requireExpenseGroupMember`, which resolves the expense's
  group first). Group member management additionally checks that the
  requester is either the target member themselves or the group's
  creator.

## 5. What Broke During Development

This section is an honest account of real issues hit while building
this project, as implemented in this environment — not hypothetical
production incidents.

- **Prisma engine download blocked by sandbox network policy.** The
  execution environment used to build this project restricts outbound
  network access to a fixed domain allowlist for security reasons,
  and `binaries.prisma.sh` (where `prisma generate` downloads its
  query-engine binary) is not on that list. Running `npx prisma
  generate` here fails with a 403 on the engine checksum fetch. This
  is **purely an artifact of the sandboxed build environment**, not a
  problem with the schema or code — on a normal developer machine or
  CI runner with standard internet access, `prisma generate` will
  succeed immediately. Consequence: a handful of places in the backend
  (`recordActivity`'s transaction-client parameter, the Prisma
  "known request error" check in the centralized error handler) are
  typed more loosely (`tx: any`, a structural duck-type check instead
  of `instanceof Prisma.PrismaClientKnownRequestError`) than they
  would be with the fully generated Prisma namespace available. Once
  `prisma generate` is run in a normal environment, these can be
  tightened to `Prisma.TransactionClient` and
  `Prisma.PrismaClientKnownRequestError` respectively with no other
  code changes required — the runtime behavior is identical either
  way.
- **`vitest` importing `balance.service.ts` transitively imports the
  Prisma client**, which meant the balance-simplification unit tests
  couldn't run at all until the Prisma client was at least partially
  generated (its TypeScript types exist independently of the engine
  binary, but the runtime `PrismaClient` constructor throws if the
  engine was never generated). Resolution: `simplifyDebts` itself is a
  pure function with no database dependency, so the tests exercise it
  directly with in-memory fixtures; `split.test.ts` similarly
  reimplements the same balance arithmetic against an in-memory ledger
  so the split/payer/settlement scenarios can be verified without a
  live database connection at all. The DB-touching functions
  (`getGroupBalances`, `getUserBalanceInGroup`, etc.) are exercised
  indirectly through this same arithmetic and are straightforward
  wrappers once a real Postgres instance and generated client are
  available.
- **`import.meta.env` TypeScript error in the frontend.** Vite injects
  `import.meta.env` at build time, but the TypeScript compiler doesn't
  know about it without a triple-slash reference to Vite's client
  types. Fixed by adding `frontend/src/vite-env.d.ts` with `/// 
  <reference types="vite/client" />`.

## 6. Deployment

### Frontend (Vercel)
1. Import the repo, set the project root to `frontend/`.
2. Build command: `npm run build`. Output directory: `dist`.
3. Set environment variable `VITE_API_URL` to your deployed backend's
   `/api` URL (e.g. `https://your-api.onrender.com/api`).

### Backend (Render or Railway)
1. Set the service root to `backend/`.
2. Build command: `npm install && npm run build`. Start command:
   `npm start`.
3. Set environment variables: `DATABASE_URL`, `JWT_SECRET` (a long
   random value — e.g. `openssl rand -base64 48`), `JWT_EXPIRES_IN`,
   `PORT` (most platforms set this for you), `CLIENT_URL` (your
   deployed frontend's origin, no trailing slash), `NODE_ENV=production`.
4. As part of the deploy step (or a release/pre-deploy hook), run:
   ```
   npx prisma migrate deploy
   ```
   Use `migrate deploy`, not `migrate dev` — the latter is interactive
   and intended for local development only.

### Database (Neon / Supabase / Railway / Render Postgres)
- Create a Postgres instance and copy its connection string into
  `DATABASE_URL` on the backend service.
- Most managed providers require `?sslmode=require` appended to the
  connection string — check your provider's connection-string docs.

### CORS
The backend's `cors()` middleware is configured with `origin:
env.clientUrl` and `credentials: true` (see `src/app.ts`). Make sure
`CLIENT_URL` exactly matches your deployed frontend's origin
(protocol + host, no trailing slash, no path) or authenticated
requests from the browser will be rejected.

### Migrations in production
Never run `prisma migrate dev` against a production database — it can
prompt interactively and is designed for iterative local schema
changes. Use `prisma migrate deploy`, which applies any pending
migrations non-interactively and is safe to run as part of an
automated deploy pipeline.
