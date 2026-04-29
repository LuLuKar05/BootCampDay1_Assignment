# Development Log — Assignment1

A running record of decisions made, changes applied, what's next, and things to think about as the project grows.

---

## What This Project Is

A full-stack learning project split into two independent apps:

- **`client/`** — Next.js 16 frontend (App Router)
- **`server/`** — Express + TypeScript backend with TypeORM and SQLite

They run as separate processes on different ports and communicate over HTTP.

---

## Changes Made (in order)

### 1. Project structure decision — client/server split

**What:** Replaced the original single Next.js project at root with two separate apps under `client/` and `server/`.

**Why:** Next.js route handlers (`route.js`) are convenient but they blur the line between frontend and backend. For a project that needs a real database layer (TypeORM), a dedicated Express server is a cleaner separation. The client calls the server's API; the server owns all data logic.

**Result:**
```
Assignment1/
  client/     ← Next.js frontend, own package.json
  server/     ← Express backend, own package.json
```

**What was deleted from root:** `src/`, `package.json`, `package-lock.json`, `next.config.mjs`, `jsconfig.json`, `README.md`, `node_modules/`

---

### 2. Client — Next.js scaffolding

**Files created:**
| File | Purpose |
|---|---|
| `client/package.json` | Next.js 16 + react-compiler |
| `client/next.config.mjs` | `reactCompiler: true` |
| `client/jsconfig.json` | `@/*` path alias → `src/*` |
| `client/src/app/layout.js` | Root layout (html + body shell) |
| `client/src/app/page.js` | Home page placeholder |
| `client/.env.local.example` | Template — copy to `.env.local` |

**Environment variable needed:**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

### 3. Server — Express scaffolding (JavaScript, then migrated)

**Initial state:** Plain JavaScript, ESM (`"type": "module"`), Express + cors + dotenv.

**Files created initially:**
| File | Purpose |
|---|---|
| `server/src/index.js` | Express entry point |
| `server/src/routes/index.js` | GET / and GET /:slug routes |
| `server/package.json` | dependencies + ESM config |
| `server/.env.example` | Template — copy to `.env` |

**API routes at this stage:**
- `GET /` → `{ message: "Hello world!" }`
- `GET /:slug` → `{ message: "Hello <slug>!" }`

---

### 4. Server — Migrated to TypeScript + TypeORM + SQLite

**Why TypeScript:** TypeORM is designed around TypeScript decorators (`@Entity`, `@Column`, etc.). Using it with plain JavaScript is possible but loses the main ergonomic benefit and most documentation assumes TypeScript.

**Why CommonJS (not ESM):** TypeORM has historically had friction with Node.js ESM. Removing `"type": "module"` and compiling to CommonJS avoids this class of issues entirely. `tsx` handles running TypeScript directly in dev so there is no compile step during development.

**Why SQLite / `better-sqlite3`:** No database server to install — the database is a single file (`database.sqlite`). Ideal for learning and local development. `better-sqlite3` is the faster, synchronous driver; TypeORM supports it with `type: "better-sqlite3"`.

**Changes to `server/package.json`:**
- Removed `"type": "module"`
- Updated scripts: `dev` now uses `tsx watch`, added `build` (tsc) and `start` (node dist/)
- Added dependencies: `typeorm`, `reflect-metadata`, `better-sqlite3`
- Added devDependencies: `typescript`, `tsx`, `@types/*`

**New files created:**
| File | Purpose |
|---|---|
| `server/tsconfig.json` | TypeScript config — decorators enabled |
| `server/src/database/data-source.ts` | `AppDataSource` — TypeORM connection |
| `server/src/index.ts` | Entry point (replaces `index.js`) |
| `server/src/routes/index.ts` | Express routes (replaces `routes/index.js`) |

**Old files deleted:** `src/index.js`, `src/routes/index.js`

**Key `tsconfig.json` flags:**
```json
"experimentalDecorators": true,
"emitDecoratorMetadata": true
```
These two are mandatory for TypeORM. Without them, decorators like `@Entity()` and `@Column()` silently do nothing.

**Current `data-source.ts`:**
```ts
export const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: "database.sqlite",
  synchronize: true,     // ← DEV ONLY
  logging: true,
  entities: [],          // ← add entity classes here
  migrations: [],
});
```

**`reflect-metadata` rule:** It must be imported once, at the very top of the entry point (`index.ts`), before anything else. It patches the global environment that TypeORM decorators depend on.

**`.gitignore` additions:** `server/dist/`, `server/database.sqlite`

---

## Current File Tree

```
Assignment1/
  client/
    src/app/
      layout.js
      page.js
    next.config.mjs
    jsconfig.json
    package.json
    .env.local.example

  server/
    src/
      database/
        data-source.ts      ← AppDataSource
      entities/             ← empty, ready for entity classes
      routes/
        index.ts            ← GET / and GET /:slug
      index.ts              ← Express entry point
    tsconfig.json
    package.json
    .env.example

  projectStructure.md
  DEVLOG.md                 ← this file
  AGENTS.md
  CLAUDE.md
  .gitignore
```

---

## How to Run

```bash
# Terminal 1 — backend (port 3001)
cd server
npm install
npm run dev

# Terminal 2 — frontend (port 3000)
cd client
npm install
npm run dev
```

On first server start, `server/database.sqlite` is created automatically.

---

## What Comes Next

### Immediate — add your first entity

Create `server/src/entities/User.ts`:
```ts
import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;
}
```

Then register it in `data-source.ts`:
```ts
import { User } from "../entities/User";

entities: [User],
```

Because `synchronize: true` is on, TypeORM will create the `user` table automatically on next server start.

### After entities — wire up routes

Use the entity's repository in a route to read/write data:
```ts
import { AppDataSource } from "../database/data-source";
import { User } from "../entities/User";

const userRepo = AppDataSource.getRepository(User);

router.get("/users", async (_req, res) => {
  const users = await userRepo.find();
  res.json(users);
});
```

### After routes — connect the client

Use `NEXT_PUBLIC_API_URL` in client components to fetch from the server:
```ts
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`);
const users = await res.json();
```

---

## Things to Think About and Consider

### `synchronize: true` is for development only
TypeORM reads your entity classes and auto-creates/updates tables to match. This is convenient locally but **dangerous in production** — it can drop columns if you rename them. Before going to production, set `synchronize: false` and use migrations instead:
```bash
npx typeorm migration:generate src/migrations/InitialSchema -d src/database/data-source.ts
npx typeorm migration:run -d src/database/data-source.ts
```

### Input validation
Express does not validate request bodies for you. Before saving anything to the database, validate incoming data. Two common options:
- **`zod`** — parse and validate plain objects, works with or without TypeScript decorators
- **`class-validator` + `class-transformer`** — decorator-based, integrates tightly with TypeORM entity classes

### Error handling
Currently if a route throws an error, Express will return a generic 500 with no useful message. Add a centralized error handler at the bottom of `index.ts`:
```ts
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});
```

### CORS in production
The current `app.use(cors())` allows all origins — fine for local development, but in production you should restrict it to your client's domain:
```ts
app.use(cors({ origin: process.env.CLIENT_URL }));
```

### Authentication
When you need to protect routes (e.g. only logged-in users can access `/users`), consider:
- **JWT (JSON Web Tokens)** — stateless, client stores the token, server verifies it on each request. Good for APIs.
- **Sessions + cookies** — stateful, server keeps session state. Requires `express-session`.
  
For JWT: `jsonwebtoken` package + a middleware that checks the `Authorization: Bearer <token>` header.

### Separation of concerns — services layer
Right now routes talk directly to repositories. As the app grows, consider extracting business logic into a service layer:
```
routes/users.ts     ← HTTP concerns only (parse req, send res)
services/users.ts   ← business logic (calls repository)
entities/User.ts    ← data shape
```

This makes logic easier to test and reuse.

### Testing
- **Unit tests** — test service functions in isolation (mock the repository)
- **Integration tests** — spin up an in-memory SQLite database and test routes end-to-end
- Consider `vitest` or `jest` as the test runner

### Switching databases later
Because TypeORM abstracts the database, switching from SQLite to PostgreSQL (for production deployment) is mostly a config change in `data-source.ts` — change `type`, `host`, `port`, `username`, `password`, `database`. Your entity and route code stays the same.

### Environment secrets
Never commit `.env` files. Use `.env.example` to document what variables are needed, and fill in real values in `.env` locally. For deployment, set environment variables through your hosting platform (Railway, Render, Fly.io, etc.).
