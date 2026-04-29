# Project Structure

## Summary

This project is split into two independent apps: a **Next.js frontend** (`client/`) and an **Express backend** (`server/`). They run as separate processes and communicate over HTTP — the client calls the server's API endpoints to fetch or send data.

The root of `Assignment1/` holds only shared project files (this document, git config, and Claude instructions). All application code lives inside `client/` or `server/`, each with its own `package.json` and `node_modules/`.

---

## Folder Structure

```
Assignment1/
  client/                       Next.js frontend
    src/
      app/
        layout.js               Root HTML shell (html + body tags)
        page.js                 Home page UI
    next.config.mjs             Next.js configuration
    jsconfig.json               Path alias (@/* → src/*)
    package.json                Frontend dependencies
    .env.local.example          Copy to .env.local — set API URL here

  server/                       Express backend
    src/
      index.js                  App entry point — starts the Express server
      routes/
        index.js                API routes (GET / and GET /:slug)
    package.json                Backend dependencies (express, cors, dotenv)
    .env.example                Copy to .env — set PORT here
```

---

## Key Notes

### Two separate apps, two separate installs
Each folder has its own `package.json`. You must run `npm install` inside **both** `client/` and `server/` before starting either one. They do not share `node_modules/`.

### Environment variables
- `server/.env` controls the port the Express server listens on (`PORT=3001`).
- `client/.env.local` tells Next.js where to find the API (`NEXT_PUBLIC_API_URL=http://localhost:3001`).
- Neither `.env` file is committed to git — copy the `.example` files and fill in values locally.

### How to run
```bash
# Terminal 1 — start the backend
cd server
npm install
npm run dev        # uses node --watch for auto-restart on file changes

# Terminal 2 — start the frontend
cd client
npm install
npm run dev        # starts Next.js on http://localhost:3000
```

### API routes live in the server, not Next.js
The Next.js `route.js` handler pattern has been replaced by Express routes in `server/src/routes/index.js`. The client (`page.js`, etc.) fetches data from the Express server — it does not define its own API endpoints.

### `client/` uses the Next.js App Router
Pages go in `src/app/` as `page.js` files. Layouts go in `layout.js`. There are no `route.js` files in the client — those belong in the server.

### Adding new API endpoints
Add new route handlers in `server/src/routes/`. You can split them into separate files (e.g., `users.js`, `posts.js`) and import them into `index.js` using `router.use()`.

### Adding new pages
Add new folders/files under `client/src/app/`. A folder named `about/` with a `page.js` inside becomes the `/about` page.
