# Sneaker Drop — Backend API

Real-Time Inventory System for Limited Edition Sneaker Drops.
**Stack:** Node.js · Express · TypeScript · PostgreSQL · Sequelize · Socket.io

---

## How to Run

### Prerequisites
- Node.js ≥ 18
- PostgreSQL running locally (or a hosted Neon DB URL)
- `pnpm` (or swap `pnpm` for `npm`/`yarn` everywhere)

### 1. Clone & Install

```bash
git clone <repo-url>
cd backend
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASS@localhost:5432/sneaker_drop
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### 3. Create the Database (local Postgres)

```bash
# Connect as postgres superuser and create the database + role
psql -U postgres -c "CREATE DATABASE sneaker_drop;"
psql -U postgres -c "CREATE USER sneaker_user WITH PASSWORD 'your_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE sneaker_drop TO sneaker_user;"
```

### 4. Start the Server

```bash
pnpm dev
```

On first boot, `sequelize.sync({ alter: true })` automatically creates all tables
(`drops`, `users`, `reservations`, `purchases`) with the correct schema and indexes.
No manual migration command needed.

### 5. Seed a Test Drop (optional)

```bash
curl -X POST http://localhost:4000/api/drops \
  -H "Content-Type: application/json" \
  -d '{"name":"Air Jordan 1 Chicago","price":299.99,"total_stock":10,"starts_at":"2025-01-01T00:00:00Z"}'
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/drops` | List all drops + top-3 recent purchasers |
| `POST` | `/api/drops` | Create a new drop |
| `POST` | `/api/users` | Find or create a user by username |
| `POST` | `/api/reservations` | Reserve a drop unit (atomic) |
| `POST` | `/api/reservations/:id/purchase` | Complete purchase for a reservation |

### POST /api/drops
```json
{
  "name": "Air Jordan 1 Chicago",
  "price": 299.99,
  "total_stock": 100,
  "starts_at": "2025-01-01T00:00:00Z"
}
```

### POST /api/users
```json
{ "username": "sneakerhead_42" }
```

### POST /api/reservations
```json
{ "drop_id": 1, "user_id": 1 }
```

### POST /api/reservations/:id/purchase
```json
{ "user_id": 1 }
```

---

## Architecture Decisions

### How did you handle the 60-second expiration logic?

**Decision: Periodic database sweep (node-cron, every 5 seconds).**

A `node-cron` job runs every 5 seconds, queries for all `reservations` where
`status = 'active' AND expires_at < NOW()`, and for each one:
1. Opens a Postgres transaction
2. Uses `SELECT ... FOR UPDATE` to lock the row (prevents two overlapping sweeps from double-expiring)
3. Increments `drops.available_stock` back by 1
4. Sets `reservation.status = 'expired'`
5. Commits, then emits a `STOCK_UPDATED` WebSocket event

**Why a sweep instead of `setTimeout` per reservation:**

`setTimeout` timers live only in Node's process memory. A server restart or crash silently loses every pending timer — stock for those reservations never comes back. The database retains state across restarts. A sweep re-derives the correct answer from the DB every 5 seconds, regardless of how many times the server has restarted. This is stateless, idempotent, and correct by construction.

The trade-off: a 0–5 second imprecision window on the exact expiry moment. For a 60-second window this is acceptable (< 8% of the window). For tighter precision you could layer an in-memory `setTimeout` for instant UI feedback while keeping the sweep as the authoritative fallback.

---

### Concurrency: How did you prevent multiple users from claiming the same last item?

**Decision: Conditional atomic UPDATE (no explicit application-level locks).**

```sql
UPDATE drops
SET available_stock = available_stock - 1
WHERE id = :dropId
  AND available_stock > 0
RETURNING available_stock
```

This single SQL statement is the heart of the race condition solution. PostgreSQL guarantees that concurrent `UPDATE`s to the same row are serialized at the database engine level. If 100 requests arrive simultaneously for the last 1 unit:

- All 100 reach Postgres
- Postgres queues their writes to that single row
- The first one to acquire the row lock finds `available_stock = 1 > 0` → succeeds, decrements to 0
- All remaining 99 find `available_stock = 0`, the `WHERE` clause filters them out → 0 rows affected
- Our service returns a `409 SOLD_OUT` for each of the 99 losers

**Why not `SELECT ... FOR UPDATE` (pessimistic locking)?**

`SELECT FOR UPDATE` is a valid alternative: read the current stock, lock the row, check, update, release. It also serializes correctly. However, it requires two round-trips (SELECT + UPDATE) and holds a row lock for longer, increasing lock contention under high concurrency. The conditional UPDATE achieves the same correctness with less code and shorter lock windows.

**Why not application-level mutexes or Redis distributed locks?**

We don't have Redis in this stack. Application-level mutexes break the moment you run more than one Node process. PostgreSQL's row-level locking is the right tool — it's exactly what databases are designed for.

---

## WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `STOCK_UPDATED` | Server → Client | `{ dropId: number, availableStock: number }` |
| `RESERVATION_EXPIRED` | Server → Client | `{ reservationId: number, dropId: number }` |
| `JOIN_DROP` | Client → Server | `dropId: number` |

Clients can join a drop-specific room (`JOIN_DROP`) to receive scoped updates,
or simply listen globally — all stock updates are broadcast to both.

---

## Database Schema

```
drops
  id              SERIAL PRIMARY KEY
  name            VARCHAR(255)
  price           DECIMAL(10,2)
  total_stock     INTEGER
  available_stock INTEGER          ← single source of truth, atomically managed
  starts_at       TIMESTAMPTZ
  created_at      TIMESTAMPTZ

users
  id              SERIAL PRIMARY KEY
  username        VARCHAR(100) UNIQUE
  created_at      TIMESTAMPTZ

reservations
  id              SERIAL PRIMARY KEY
  drop_id         INTEGER → drops.id
  user_id         INTEGER → users.id
  status          ENUM('active','expired','completed')
  expires_at      TIMESTAMPTZ      ← read by expiration sweep
  created_at      TIMESTAMPTZ
  INDEX (status, expires_at)      ← covers expiration sweep query

purchases
  id              SERIAL PRIMARY KEY
  drop_id         INTEGER → drops.id
  user_id         INTEGER → users.id
  reservation_id  INTEGER → reservations.id  UNIQUE
  created_at      TIMESTAMPTZ
  INDEX (drop_id, created_at)     ← covers activity feed query
```

---

## Deployment (Bonus)

- **Frontend:** Vercel
- **Backend:** Vercel Serverless or Railway
- **Database:** [Neon DB](https://neon.tech/) — serverless Postgres, free tier

For Neon, set `DATABASE_URL` to the Neon connection string in your hosting provider's environment variables. The `ssl: { require: true, rejectUnauthorized: false }` option is already configured in `config/db.ts` for `NODE_ENV=production`.

> ⚠️ Never commit your `.env` file. Use hosting platform environment variables.
