# linqsafe

Link-in-bio pages for creators and small businesses. Sign up, add your links, pick a template, and share one URL (`/yourname`). Extra features (unlimited links, premium templates, a founder's note, testimonials, a QR code) are each bought on their own for 1, 3, 6 or 12 months, paid in naira through Paystack. The founder sets prices from the founder dashboard.

**Stack:** React 18 · Vite · Tailwind CSS · Framer Motion · GSAP · three.js · Express · MySQL 8 · Resend (email) · Paystack (payments) · Vercel (hosting)

For the full picture (features, architecture, database, stages, security, design system), see **[PROJECT.md](PROJECT.md)**. For a step-by-step guide to rebuilding a project like this, see **[docs/linqsafe-Build-Guide.pdf](docs/linqsafe-Build-Guide.pdf)**.

## Run locally (Node + MySQL)

Requires Node 22 and a running MySQL 8.

```bash
cp .env.example .env      # fill in DB_* and JWT_SECRET
npm install
npm run dev               # API on :3001, site on :5173, founder console on admin.localhost:5173
npm run owner             # after signing up with OWNER_EMAIL: verifies it and unlocks every feature
```

The database schema is created and updated automatically on start (`server/migrations.js`). Verify and reset emails are printed in the terminal until `RESEND_API_KEY` is set.

## Run with Docker (optional)

Docker is **not** needed for local development or for Vercel. It's an alternative way to run everything in containers, or to deploy to a Docker-based host.

**Whole stack (app + MySQL):**

```bash
docker compose up --build    # site + API at http://localhost:3001
```

`docker-compose.yml` starts MySQL 8.4 (data kept in a `db-data` volume) and the app, using the values in `.env`. Inside Docker the app reaches the database at `db`, not `localhost`. The compose file sets that for you.

**App image only** (when your database is hosted elsewhere):

```bash
docker build -t linqsafe --build-arg APP_STAGE=prod .
docker run -p 3001:3001 --env-file .env linqsafe
```

**How the image works:** a two-stage build. Stage 1 installs everything and builds the frontend into `dist/`. Stage 2 is a slim Node 22 Alpine image with production dependencies, `server/` and `dist/` only. It runs as the non-root `node` user, serves the API and the site on port 3001, and has a health check on `/api/health`.

## Deploy

- **Namecheap cPanel (live site):** `npm run package`, upload `linqsafe-deploy.zip`, run it as a cPanel Node.js App with startup file `app.cjs`. Step-by-step in PROJECT.md → *Namecheap (cPanel)*.
- **Vercel:** import the repo. `vercel.json` routes `/api/*` to the Express app as a serverless function (`api/index.js`) and serves the built site. Set the environment variables per stage. See _Stages_ in PROJECT.md.
- **Docker hosts** (Render, Railway, Fly, a VPS): build from the `Dockerfile`, set the same environment variables, health check path `/api/health`.
- **Any Node host:** build `npm ci && npm run build`, start `npm start`.

In production the server refuses to start without a real `JWT_SECRET` (`openssl rand -hex 32`).

## Scripts

| Command                                      | Does                                                    |
| -------------------------------------------- | ------------------------------------------------------- |
| `npm run dev`                                | API + site with live reload                             |
| `npm run build`                              | Build the frontend into `dist/`                         |
| `npm start`                                  | Production server (API + `dist/`)                       |
| `npm test`                                   | API tests against the running dev server                |
| `npm run owner`                              | Verify the owner email and unlock every feature (local) |
| `npm run set-plan -- <username> <free\|pro>` | `pro` unlocks every feature by hand (no expiry)         |

## Environment variables

See [`.env.example`](.env.example) for the full list with comments: database, `JWT_SECRET`, `APP_URL`, Resend, `OWNER_EMAIL` / `ADMIN_HOST`, Paystack (`PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`), default feature prices (`PRICE_*`, `DISCOUNT_*`), `APP_STAGE`.

## Accessibility

Skip link, focus moved on navigation with a screen-reader announcement, labelled fields with described errors, visible focus rings, keyboard-reorderable links, and `prefers-reduced-motion` respected by Framer Motion, GSAP and the 3D scene.
