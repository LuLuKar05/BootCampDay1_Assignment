# Entity Design Notes — Concert Ticketing System

## Overview

This document captures the schema review, design decisions, and architectural discussion for the three core entities of the high-demand concert ticketing platform.

---

## Initial Schema Review

### `User` Entity (original)
```
userId (PK) | name | password | email (unique) | tickets (OneToMany → Ticket)
```

### `Concert` Entity (original)
```
id (PK) | name | totalTickets | availableTickets | concertTime | tickets (OneToMany → Ticket)
```

### `Ticket` Entity (original)
```
id (PK) | issuedAt | seatNumber | price | concert (ManyToOne → Concert) | users (OneToMany → User)
```

### Critical Issues Found

| Severity | Entity | Issue |
|----------|--------|-------|
| Critical | `Ticket` | `OneToMany → User` should be `ManyToOne → User` |
| Critical | `User` | Password stored without hashing |
| High | `Concert` | `availableTickets` counter races under concurrent load |
| High | `Ticket` | `price` uses plain number instead of decimal |
| Medium | `Concert` | Missing `venue`, `status`, artist info |
| Medium | `Ticket` | Missing `status`, booking reference |
| Low | `User` | Missing `role`, `createdAt` |

---

## Ticket Entity

### Ticket → User Relationship

Two different concepts must not be conflated:

- **Ticket type** = "VIP category for Concert X" → can have many buyers
- **Ticket instance** = the actual issued ticket (one seat, one scan, one admission)

The `Ticket` entity models an **instance** (it has `seatNumber`, `issuedAt`, `price`). For an instance, the relationship is always `ManyToOne → Customer` — one person owns one seat.

### Future: Multiple Ticket Tiers

When multiple price tiers are needed, introduce a `TicketTier` entity:

```ts
@Entity()
export class TicketTier {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string; // "VIP", "General Admission", "Front Row"

    @Column({ type: "decimal", precision: 10, scale: 2 })
    price: number;

    @Column()
    totalSeats: number;

    @Column()
    availableSeats: number; // race condition lives here now, not on Concert

    @ManyToOne(() => Concert, (concert) => concert.tiers)
    concert: Concert;

    @OneToMany(() => Ticket, (ticket) => ticket.tier)
    tickets: Ticket[];
}
```

- `Ticket` references `TicketTier` instead of holding `price` directly
- The race condition moves off `Concert` and onto `TicketTier` — more granular
- For now, one tier is fine; this is the natural extension path

### Status: Stored vs. Calculated

Split by whether the state is derivable from time or set by business logic:

| State | Derivable? | How |
|---|---|---|
| `UPCOMING` | Yes | `concertTime > now` |
| `ONGOING` | Yes | `startTime <= now <= endTime` |
| `ENDED` | Yes | `endTime < now` |
| `CANCELLED` | No | Must be stored |
| `POSTPONED` | No | Must be stored |

**Decision:** Only store exceptional states (`CANCELLED`, `POSTPONED`) in the DB. Derive the rest in the service layer or at render. This avoids stale-data bugs where the DB says `UPCOMING` but the concert already ended.

For **Ticket** status (`RESERVED`, `CONFIRMED`, `CANCELLED`, `REFUNDED`) — these are all business-driven, none are derivable. Store them all.

### Price Column

Use decimal to avoid floating-point rounding errors on money values:

```ts
@Column({ type: "decimal", precision: 10, scale: 2 })
price: number;
```

---

## User Entity → Renamed to `Customer`

### Design Decision: Remove Password

This entity stores **customer info per concert/ticket**, not platform login accounts. Therefore:

- Remove `password`
- Rename `User` → `Customer`
- Remove `unique` constraint on `email` — the same person can appear across multiple concerts, duplicates are intentional
- No `role` field — admin will be a separate independent entity
- Move `createdAt` here from `Ticket.issuedAt` (the ticket is "issued" when the customer record is created — `issuedAt` on Ticket is redundant)

### Password Hashing vs. Encryption at Rest

These are related but distinct concepts (kept for future reference when implementing the Admin entity):

- **Encryption at rest** = the database files on disk are encrypted (e.g., SQLite with SQLCipher, AES-256). Protects against physical disk theft.
- **Password hashing** (bcrypt, argon2) = a one-way transform so that even if someone reads the DB rows, they cannot reverse the hash. Protects credentials specifically.

Both should be used together. They operate at different layers.

### Recommended `Customer` Entity

```ts
@Entity()
export class Customer {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    email: string;

    @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
    createdAt: Date;

    @OneToMany(() => Ticket, (ticket) => ticket.customer)
    tickets: Ticket[];
}
```

---

## Concert Entity

### Layer Clarification

| Layer | What it is | Examples in this project |
|---|---|---|
| Domain / Model layer | Shape of data only, no logic | Entity files (`concert.tsx`, etc.) |
| Data Access Layer (DAL) | Queries, transactions, locking | Repository / Service classes |
| Infrastructure layer | Connection config | `data-source.ts` |

Locking logic does **not** belong in the entity. It belongs in the DAL (service or repository).

### Race Condition Solutions for `availableTickets`

All realistic options, ordered from simplest to most scalable:

#### Option 1 — Optimistic Locking (TypeORM built-in)

Add `@VersionColumn()` to `Concert`. TypeORM checks the version on every update and throws `OptimisticLockVersionMismatchError` if another transaction updated the row first. Catch and retry.

```ts
@VersionColumn()
version: number;
```

- Pro: No extra infrastructure, built into TypeORM
- Con: Under very high contention, retries pile up. Good for moderate load.

#### Option 2 — Pessimistic Locking (SELECT FOR UPDATE)

In the service/repository, use a transaction with a row lock:

```ts
await dataSource.transaction(async (manager) => {
    const concert = await manager.findOne(Concert, {
        where: { id },
        lock: { mode: "pessimistic_write" }
    });
    if (concert.availableTickets < 1) throw new Error("Sold out");
    concert.availableTickets -= 1;
    await manager.save(concert);
});
```

- Pro: Guarantees no overselling, accurate count
- Con: Serializes all ticket purchases for a concert — slow under extreme load

#### Option 3 — Remove the Counter, Calculate Instead

Delete `availableTickets` from `Concert`. Calculate on demand:

```sql
totalTickets - COUNT(tickets WHERE status = 'CONFIRMED')
```

- Pro: Always accurate, no race condition possible
- Con: Expensive query on every availability check. Needs caching to be viable.

#### Option 4 — Redis Atomic Decrement (High-demand)

Store `availableTickets` in Redis using `DECR` (atomic at the Redis level):

1. User requests ticket → `DECR concert:{id}:available` in Redis
2. If result >= 0: proceed to DB write
3. If result < 0: `INCR` it back, return "Sold out"
4. DB is the source of truth; Redis is the fast gate

- Pro: Extremely fast, handles massive concurrency
- Con: Requires Redis infrastructure, eventual consistency between Redis and DB requires a sync strategy

#### Option 5 — Queue-based (Extreme demand)

All purchase requests go into a queue (Redis Queue, SQS, BullMQ). A worker processes them serially per concert. No locking needed.

- Pro: No DB contention at all, handles demand spikes naturally
- Con: Most complex, purchases are async (user waits for queue result)

#### Recommendation

**Start with Option 2 (Pessimistic Locking)** — correct, no extra infrastructure, lives in the DAL.  
**Add Option 4 (Redis)** when load testing shows the DB lock is the bottleneck.

### CQRS for Static Concert Data

Concert data splits into two categories naturally:

- **Write-heavy / time-sensitive:** `availableTickets`, ticket status
- **Read-heavy / rarely changes:** `venue`, `artistName`, `description`, `concertTime`

The practical progression (no need to split databases immediately):

**Phase 1 (now):** Single DB. Add admin-only guards in the service layer for static fields so they can't be accidentally mutated.

**Phase 2:** Add a Redis cache with a long TTL (hours/days) for concert detail reads. Invalidate on admin update. App reads from Redis first, falls back to DB.

**Phase 3 (if needed):** True CQRS — admin writes go to a write DB, a projection syncs to a read-optimized store (Elasticsearch for full-text search, or a read replica).

> **Key insight:** `availableTickets` should **never** be in the read model cache — it changes on every ticket purchase. Keep it on the write side only, exposed through a real-time query or Redis counter (Option 4).

---

## Summary of Planned Changes

| Entity | Change |
|---|---|
| `Ticket` | Fix to `ManyToOne → Customer`, add `status` column, keep decimal price, remove `issuedAt` |
| `User` → `Customer` | Remove `password`, remove `email` unique constraint, add `createdAt` |
| `Concert` | Add `endTime`, protect `availableTickets` with pessimistic lock in DAL, add nullable `status` (CANCELLED/POSTPONED only), plan `TicketTier` for future |
| `Admin` | Separate entity to be created independently with password hashing (bcrypt/argon2) |

---

## Future Entities to Add

- `Admin` — platform admin with hashed password, role-based permissions
- `TicketTier` — price tiers per concert (VIP, General Admission, etc.) when multi-tier support is needed

---

## Concert Status — Scheduler Design

### Store vs. Derive (Final Decision)

Two approaches were considered:

| State | Derivable from time? |
|---|---|
| `UPCOMING` | Yes — `startTime > now` |
| `NEAR` | Yes — `startTime - now <= 48h` |
| `ONGOING` | Yes — `startTime <= now <= endTime` |
| `ENDED` | Yes — `endTime < now` |
| `CANCELLED` | No — admin only |
| `POSTPONED` | No — admin only |

**Option A (originally considered):** Only store `CANCELLED`/`POSTPONED` in the DB and derive the rest in the service layer at read time. Avoids stale data, but every query runs date math — expensive at scale.

**Option B (final decision):** Store all statuses in the DB and use a `node-cron` scheduler to update them. The `@Index()` on `status` makes `WHERE status = 'UPCOMING'` queries instant, and the work is done once by the scheduler rather than on every read.

### Scheduler Transition Rules

Order matters — run ENDED first, then ONGOING, then NEAR. Otherwise a concert that just ended could be incorrectly marked ONGOING in the same tick.

| Current Status | Condition | → New Status |
|---|---|---|
| `UPCOMING` or `NEAR` | `startTime - now <= 48h` | `NEAR` |
| `UPCOMING` or `NEAR` | `now >= startTime` | `ONGOING` |
| `ONGOING` | `now > endTime` | `ENDED` |
| `ENDED` | — | never changes (terminal) |
| `CANCELLED` | — | scheduler always skips |
| `POSTPONED` | — | scheduler always skips |

**Critical rule:** Every scheduler query must include `WHERE status NOT IN ('CANCELLED', 'POSTPONED')`. These are admin-controlled states and must never be overwritten automatically.

### Recommended node-cron Implementation

```ts
import cron from "node-cron";
import { AppDataSource } from "../database/data-source";
import { Concert, ConcertStatus } from "../entities/concert";

cron.schedule("* * * * *", async () => {
    const repo = AppDataSource.getRepository(Concert);
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const adminStates = [ConcertStatus.CANCELLED, ConcertStatus.POSTPONED];

    // 1. ENDED — must run first
    await repo.createQueryBuilder()
        .update(Concert)
        .set({ status: ConcertStatus.ENDED })
        .where("endTime < :now", { now })
        .andWhere("status NOT IN (:...skip)", { skip: adminStates })
        .execute();

    // 2. ONGOING
    await repo.createQueryBuilder()
        .update(Concert)
        .set({ status: ConcertStatus.ONGOING })
        .where("startTime <= :now AND endTime >= :now", { now })
        .andWhere("status NOT IN (:...skip)", { skip: adminStates })
        .execute();

    // 3. NEAR — exclude ONGOING so a just-started concert isn't downgraded
    await repo.createQueryBuilder()
        .update(Concert)
        .set({ status: ConcertStatus.NEAR })
        .where("startTime > :now AND startTime <= :in48h", { now, in48h })
        .andWhere("status NOT IN (:...skip)", { skip: [...adminStates, ConcertStatus.ONGOING] })
        .execute();
});
```

Using TypeORM QueryBuilder with JS `Date` objects makes this DB-agnostic — TypeORM parameterizes the dates so no raw SQL date functions are needed.

---

## Database Compatibility

The project currently uses **SQLite (better-sqlite3)** for development (`data-source.ts`). The recommended production database is **PostgreSQL**. Key differences to be aware of when switching:

### Column Type Mapping

| What you want | SQLite | PostgreSQL | MySQL/MariaDB | SQL Server |
|---|---|---|---|---|
| Date + time | `datetime` | `timestamp` | `datetime` | `datetime2` |
| Current time default | `CURRENT_TIMESTAMP` | `now()` | `CURRENT_TIMESTAMP` | `GETDATE()` |
| Decimal money | `decimal(10,2)` | `numeric(10,2)` | `decimal(10,2)` | `decimal(10,2)` |
| Varchar status | `varchar` | `varchar` or native `enum` | `varchar` or `enum` | `varchar` or `nvarchar` |

TypeORM maps most of these automatically when you change `type:` in `data-source.ts`. The exceptions below need manual attention.

### `@CreateDateColumn()` — Use Instead of Raw Defaults

The `default: () => "CURRENT_TIMESTAMP"` syntax is SQLite-specific. Use TypeORM's built-in decorator instead — it is fully DB-agnostic:

```ts
// Instead of this (SQLite only):
@Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
issuedAt: Date;

// Use this (works on all databases):
@CreateDateColumn()
issuedAt: Date;
```

### PostgreSQL Native ENUM

PostgreSQL can enforce the enum at the DB level (not just the TypeScript level):

```ts
// PostgreSQL only — TypeORM creates a real ENUM type in the DB
@Column({ type: "enum", enum: ConcertStatus, default: ConcertStatus.UPCOMING })
status: ConcertStatus;

// SQLite / MySQL — enum enforced by TypeScript only, stored as varchar
@Column({ type: "varchar", default: ConcertStatus.UPCOMING })
status: ConcertStatus;
```

### Pessimistic Locking Support

`lock: { mode: "pessimistic_write" }` (SELECT FOR UPDATE) support varies by database:

| Database | Pessimistic locking supported? |
|---|---|
| PostgreSQL | Yes |
| MySQL / MariaDB | Yes |
| SQL Server | Yes (uses `UPDLOCK` hint internally) |
| **SQLite** | **No** — SQLite locks the entire file, not individual rows. TypeORM will throw if you attempt this. |

This is a gap in the current SQLite dev setup. For development, either skip the lock or catch the error. For production, use PostgreSQL or MySQL where row-level locking works correctly.

### Scheduler Date Functions in Raw SQL

The `node-cron` scheduler uses TypeORM QueryBuilder with JS `Date` objects — this is DB-agnostic and the recommended approach. If you ever write raw SQL date arithmetic, the syntax differs per DB:

| Operation | PostgreSQL | MySQL | SQL Server | SQLite |
|---|---|---|---|---|
| Current time | `NOW()` | `NOW()` | `GETDATE()` | `datetime('now')` |
| Add 48 hours | `NOW() + INTERVAL '48 hours'` | `DATE_ADD(NOW(), INTERVAL 48 HOUR)` | `DATEADD(hour, 48, GETDATE())` | `datetime('now', '+48 hours')` |

Avoid raw SQL date functions — pass JS `Date` objects as TypeORM parameters instead and let TypeORM handle serialization.

### Summary: What Changes When Switching to PostgreSQL

| Item | SQLite (current) | PostgreSQL (production) |
|---|---|---|
| `datetime` columns | `datetime` | Change to `timestamp`, or use `@CreateDateColumn()` |
| `status` column | `varchar` | Can upgrade to native `enum` for DB-level enforcement |
| Pessimistic locking | Not supported — throws | Works natively |
| Scheduler queries | Works (use QueryBuilder) | Works (use QueryBuilder) |
| `synchronize: false` | Correct — use migrations | Same |

**PostgreSQL is the recommended production database** — it supports all design decisions in this project: pessimistic locking, native enums, `timestamp`, and full ACID compliance under high concurrency.

---

## Reservation System — Full Implementation Plan

### Overview

A `Reservation` is a temporary seat hold placed before payment. A `Ticket` is a permanent confirmed purchase. They are two distinct concepts and must not be mixed into one entity.

```
Reservation  →  temporary (expires in 15 min, no payment yet)
Ticket       →  permanent (payment confirmed, legal record)
```

---

### Current Entity State (as implemented)

#### `reservation.ts`
```ts
export enum ReservationStatus {
    PENDING    = "PENDING",    // seat held, awaiting payment
    CONFIRMED  = "CONFIRMED",  // payment received, Ticket created
    EXPIRED    = "EXPIRED",    // expiresAt passed without payment
    CANCELLED  = "CANCELLED",  // cancelled by customer or admin
}

@Entity()
export class Reservation {
    @PrimaryGeneratedColumn() id!: number;
    @Column({ length: 100 })  userName!: string;
    @Column({ length: 100 })  userEmail!: string;
    @Column()                 seatNumber!: string;
    @Column({ type: "decimal", precision: 10, scale: 2 }) price!: number;
    @Column({ type: "datetime" }) expiresAt!: Date;
    @Index()
    @Column({ type: "varchar", default: ReservationStatus.PENDING }) status!: ReservationStatus;
    @ManyToOne(() => Concert, { nullable: false }) concert!: Concert;

    @BeforeInsert()
    setExpiry() {
        this.expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min from now
    }
}
```

#### `ticket.ts`
```ts
export enum TicketStatus {
    CONFIRMED  = "CONFIRMED",  // paid and issued
    CANCELLED  = "CANCELLED",  // voided after purchase
    REFUNDED   = "REFUNDED",   // payment returned
}

@Entity()
export class Ticket {
    @PrimaryGeneratedColumn() id!: number;
    @Column({ length: 100 })  userName!: string;    // copied from Reservation on confirm
    @Column({ length: 100 })  userEmail!: string;   // copied from Reservation on confirm
    @Column()                 seatNumber!: string;  // copied from Reservation on confirm
    @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) issuedAt!: Date;
    @Column({ type: "decimal", precision: 10, scale: 2 }) price!: number; // copied from Reservation
    @Column({ type: "varchar", default: TicketStatus.CONFIRMED }) status!: TicketStatus;
    @ManyToOne(() => Concert, (concert) => concert.tickets) concert!: Concert;
    @OneToOne(() => Reservation, { nullable: true }) @JoinColumn() reservation!: Reservation | null;
}
```

**Why userName/userEmail/seatNumber/price are duplicated on Ticket:**
Ticket is a permanent legal record. If the Reservation is archived or deleted later, the Ticket must still be self-contained with all customer and seat data. The `reservation` FK on Ticket is a traceability link only ("this ticket came from reservation #X"), not the primary data source.

---

### Full Booking Flow

```
1. Customer browses concerts          GET /concerts
2. Customer picks a concert           GET /concerts/:id
3. Customer creates a reservation     POST /reservations
   └─ Reservation(PENDING) created
   └─ expiresAt = now + 15 min
   └─ availableTickets NOT changed yet
4. Customer pays within 15 min        POST /reservations/:id/confirm
   └─ ACID transaction (see below)
5. If customer doesn't pay            node-cron runs every minute
   └─ Reservation → EXPIRED
   └─ availableTickets NOT changed (was never decremented)
```

---

### ACID Payment Confirmation Transaction

`availableTickets` only decrements at payment confirmation — not at reservation creation.

**Route:** `POST /reservations/:id/confirm`

**File to create:** `server/src/routes/reservation.routes.ts`

```ts
router.post("/:id/confirm", async (req, res) => {
    const reservationId = parseInt(req.params.id);

    await AppDataSource.transaction(async (manager) => {
        // 1. Load the reservation — verify it exists and is still PENDING
        const reservation = await manager.findOne(Reservation, {
            where: { id: reservationId },
            relations: ["concert"],
        });
        if (!reservation) throw new Error("Reservation not found");
        if (reservation.status !== ReservationStatus.PENDING) throw new Error("Reservation is no longer pending");
        if (reservation.expiresAt < new Date()) throw new Error("Reservation has expired");

        // 2. Pessimistic lock on the Concert row — prevents double-booking
        const concert = await manager.findOne(Concert, {
            where: { id: reservation.concert.id },
            lock: { mode: "pessimistic_write" },
        });
        if (!concert) throw new Error("Concert not found");

        // 3. Availability check — availableTickets must never go negative
        if (concert.availableTickets < 1) throw new Error("Sold out");

        // 4. Decrement availableTickets
        concert.availableTickets -= 1;
        await manager.save(concert);

        // 5. Create Ticket — copy all customer/seat data from Reservation
        const ticket = manager.create(Ticket, {
            userName: reservation.userName,
            userEmail: reservation.userEmail,
            seatNumber: reservation.seatNumber,
            price: reservation.price,
            status: TicketStatus.CONFIRMED,
            concert: concert,
            reservation: reservation,
        });
        await manager.save(ticket);

        // 6. Mark Reservation as CONFIRMED
        reservation.status = ReservationStatus.CONFIRMED;
        await manager.save(reservation);

        // All 4 operations (concert update, ticket insert, reservation update)
        // commit together or roll back together — ACID guarantee.
    });

    res.status(201).json({ message: "Payment confirmed, ticket issued." });
});
```

**What rolls back if any step fails:**
- Step 3 fails (sold out) → nothing written, `availableTickets` unchanged
- Step 4 DB error → transaction rolled back, `availableTickets` unchanged
- Step 5 DB error → ticket NOT created, `availableTickets` restored to previous value
- Step 6 DB error → reservation stays PENDING, `availableTickets` restored, ticket NOT created

**Consistency guarantee:** `availableTickets` can never go negative because step 3 checks `>= 1` inside the same lock that prevents another transaction from reading the old value concurrently.

**SQLite dev note:** Pessimistic locking (`SELECT FOR UPDATE`) is not supported in SQLite. During development, the lock line will throw. Either wrap it in a try/catch that falls back to no-lock for SQLite, or switch to PostgreSQL for testing this flow.

---

### Expiry Scheduler (already implemented)

**File:** `server/src/scheduler/expiry.ts`

Runs every minute via `node-cron`. Marks all `PENDING` reservations whose `expiresAt` is in the past as `EXPIRED`.

```ts
cron.schedule("* * * * *", async () => {
    const result = await AppDataSource.getRepository(Reservation)
        .createQueryBuilder()
        .update(Reservation)
        .set({ status: ReservationStatus.EXPIRED })
        .where("expiresAt < :now", { now: new Date() })
        .andWhere("status = :pending", { pending: ReservationStatus.PENDING })
        .execute();
    if (result.affected && result.affected > 0) {
        console.log(`Expired ${result.affected} reservation(s).`);
    }
});
```

**Why no `availableTickets` change on expiry:** The counter was never decremented when the Reservation was created — so there is nothing to release back. The seat was never "taken" from the counter in the first place.

**Started in `index.ts`** inside `AppDataSource.initialize().then(...)` so the scheduler only runs after the DB connection is ready.

---

### Routes to Build (Pending)

#### Concert Routes (`server/src/routes/concert.routes.ts`)

| Method | Path | Description | Status |
|---|---|---|---|
| `GET` | `/concerts` | List all concerts with available tickets | ✅ Done |
| `GET` | `/concerts/:id` | Get a specific concert | Pending |

#### Reservation Routes (`server/src/routes/reservation.routes.ts`)

| Method | Path | Description | Status |
|---|---|---|---|
| `POST` | `/reservations` | Create a reservation (seat hold) | Pending |
| `POST` | `/reservations/:id/confirm` | Confirm payment → ACID transaction → Ticket issued | Pending |
| `DELETE` | `/reservations/:id` | Cancel a PENDING reservation | Pending |
| `GET` | `/reservations/:id` | Get reservation status | Pending |

#### Ticket Routes (`server/src/routes/ticket.routes.ts`)

| Method | Path | Description | Status |
|---|---|---|---|
| `GET` | `/tickets/:id` | Get a specific ticket | Pending |

---

### What Triggers `availableTickets` Changes

| Event | `availableTickets` | Who does it |
|---|---|---|
| Reservation created (PENDING) | **No change** | — |
| Reservation EXPIRED | **No change** | Expiry scheduler |
| Reservation CANCELLED | **No change** | Cancel route |
| Payment confirmed → Ticket created | **Decrement by 1** | ACID transaction in confirm route |
| Ticket CANCELLED or REFUNDED | **Increment by 1** | Ticket cancel/refund route (future) |

---

### Files Summary

| File | Status | Purpose |
|---|---|---|
| `src/entities/concert.ts` | ✅ Done | Concert entity — status, startTime, endTime, availableTickets |
| `src/entities/reservation.ts` | ✅ Done | Reservation entity — id, status, expiresAt, concert FK only (no user data) |
| `src/entities/ticket.ts` | ✅ Done | Ticket entity — all user data lives here, OneToOne → Reservation |
| `src/errors/AppError.ts` | ✅ Done | Custom error class carrying HTTP statusCode |
| `src/services/payment.service.ts` | ✅ Done | processPayment placeholder — swap body for real gateway |
| `src/services/reservation.service.ts` | ✅ Done | All reservation business logic — create, confirm (ACID), cancel, findById |
| `src/routes/reservation.routes.ts` | ✅ Done | HTTP only — parse req, call service, return res |
| `src/routes/concert.routes.ts` | Partial | GET /concerts done; GET /concerts/:id pending |
| `src/routes/ticket.routes.ts` | Not created | GET /tickets/:id |
| `src/scheduler/expiry.ts` | ✅ Done | Expires PENDING reservations every minute |
| `src/scheduler/concert-status.ts` | Not created | UPCOMING→NEAR→ONGOING→ENDED transitions |
| `src/index.ts` | ✅ Done | Starts expiry scheduler after DB connects |
| Migration: SimplifyReservation | Pending (run manually) | Drops userName, userEmail, seatNumber, price from reservation table |

---

## Project Architecture

### Three-Layer Rule

Every file in this project belongs to exactly one layer and must only do what that layer is responsible for.

```
HTTP Request
      ↓
┌─────────────────────────────────────────────┐
│  Routes Layer    src/routes/                │  Parse req → call service → return res
└─────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────┐
│  Service Layer   src/services/              │  Business logic, DB queries, transactions
└─────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────┐
│  Data Layer      src/entities/              │  TypeORM entity shape only
└─────────────────────────────────────────────┘
```

Supporting pieces that sit alongside these layers:

| Folder | Purpose |
|---|---|
| `src/errors/` | `AppError` — carries statusCode so routes need zero error-message matching |
| `src/scheduler/` | Background cron jobs — call services or repositories, started from `index.ts` |
| `src/database/` | DataSource config, migrations, seed |

---

### Layer Rules (what each layer must and must not do)

#### `src/routes/` — HTTP Layer

**Must:**
- Parse `req.body`, `req.params`, `req.query`
- Call one service method per route handler
- Return HTTP status codes and JSON responses
- Catch `AppError` and forward its `statusCode` — catch unknown errors as 500

**Must not:**
- Import `AppDataSource` or query the DB directly
- Contain any business rules or validation logic
- Know anything about payment, seats, or availability

```ts
// Every route handler follows this exact shape:
router.post("/:id/confirm", async (req, res) => {
    try {
        const ticket = await reservationService.confirm(parseInt(req.params.id), req.body);
        return res.status(201).json(ticket);
    } catch (error) {
        return handleError(res, error);  // handleError is the only logic allowed here
    }
});
```

The `handleError` helper in each route file:
```ts
function handleError(res: any, error: unknown) {
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
}
```

#### `src/services/` — Business Logic Layer

**Must:**
- Own all domain rules: seat validation, availability checks, status guards
- Run ACID transactions via `AppDataSource.transaction()`
- Throw `AppError` with the correct HTTP status on any business rule violation
- Call other services when needed (e.g. `ReservationService` calls `processPayment`)

**Must not:**
- Import `Request`, `Response`, or `Router` from Express
- Return HTTP status codes — only throw errors or return data
- Handle HTTP concerns of any kind

```ts
// Service throws — route catches and maps to HTTP
throw new AppError(409, "Sorry for the inconvenience, but this seat is already taken");
```

#### `src/entities/` — Data Layer

**Must:**
- Define TypeORM columns, relations, and indexes
- Use `@BeforeInsert` / `@AfterInsert` only for computed column defaults (e.g. `expiresAt`)

**Must not:**
- Import Express, AppDataSource, or any service
- Contain business rules or validation logic

---

### Actual Folder Structure (as built)

```
server/src/
├── database/
│   ├── data-source.ts               # TypeORM DataSource — SQLite dev, PostgreSQL prod
│   ├── seed.ts                      # Dev seed — 5 concerts covering all statuses
│   └── migrations/
│       ├── 1777550221526-InitialSchema.ts
│       └── 1777593244416-AddReservation.ts
├── entities/
│   ├── concert.ts                   # Concert entity
│   ├── reservation.ts               # Reservation entity (id, status, expiresAt, concert)
│   ├── ticket.ts                    # Ticket entity (all user data + OneToOne Reservation)
│   └── ENTITY_DESIGN_NOTES.md
├── errors/
│   └── AppError.ts                  # AppError(statusCode, message)
├── services/
│   ├── payment.service.ts           # processPayment — swap body for real gateway
│   └── reservation.service.ts      # create / confirm (ACID) / cancel / findById
├── routes/
│   ├── index.ts                     # Mounts /concerts and /reservations
│   ├── concert.routes.ts            # GET /concerts (GET /concerts/:id pending)
│   ├── reservation.routes.ts        # POST / · POST /:id/confirm · DELETE /:id · GET /:id
│   └── ticket.routes.ts             # Empty — GET /tickets/:id pending
├── scheduler/
│   └── expiry.ts                    # Expires PENDING reservations every minute
└── index.ts                         # Entry point — init DB, start scheduler, listen
```

---

### Error Flow (AppError)

Services throw `AppError(statusCode, message)`. Routes never inspect the message — they just forward the status code.

```
ReservationService.confirm()
  throws new AppError(409, "Sold out")
        ↓
reservation.routes.ts handleError()
  error instanceof AppError → res.status(409).json({ message: "Sold out" })
```

Adding a new business rule in the service requires zero changes to the route — just throw an `AppError` with the right status.

---

### `payment.service.ts` — Integration Path

**Current state:** placeholder that always succeeds (no-op function body).

**Why it is inside `AppDataSource.transaction()`:**
```ts
await AppDataSource.transaction(async (manager) => {
    await processPayment({ userName, userEmail, price });  // ← inside transaction
    concert.availableTickets -= 1;
    // ... ticket insert, reservation confirm ...
});
// If processPayment throws → all DB writes above roll back automatically
```

**To integrate Stripe:**
1. `npm install stripe`
2. Replace the body of `processPayment` in `src/services/payment.service.ts`:
```ts
export async function processPayment(details: PaymentDetails): Promise<void> {
    const intent = await stripe.paymentIntents.create({
        amount: Math.round(details.price * 100),  // Stripe uses cents
        currency: "usd",
        receipt_email: details.userEmail,
    });
    if (intent.status !== "succeeded") {
        throw new AppError(402, "Payment declined");
    }
    // If the DB write fails after this point, refund before re-throwing:
    // await stripe.refunds.create({ payment_intent: intent.id });
}
```
3. Nothing else changes — `ReservationService` and all routes stay the same.

---

### What Is Still Pending

| Item | Notes |
|---|---|
| Run `SimplifyReservation` migration | Drops unused columns from reservation table |
| `GET /concerts/:id` | Second concert route |
| `GET /tickets/:id` | Basic ticket lookup |
| `src/scheduler/concert-status.ts` | Concert UPCOMING→NEAR→ONGOING→ENDED every minute |
| Admin entity + routes | Separate entity, bcrypt password hashing |
