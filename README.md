# linqsafe

Link-in-bio pages for creators and small businesses. Sign up, add your links, pick a template, and share one URL (`/yourname`). Extra features (unlimited links, premium templates, a founder's note, testimonials, a QR code) are each bought on their own for 1, 3, 6 or 12 months, paid in naira through Paystack. The founder sets prices from the founder dashboard.

**Stack:** React 18 · Vite · Tailwind CSS · Framer Motion · GSAP · three.js · Express · MySQL 8 · Resend (email) · Paystack (payments) · Vercel (hosting)

For the full picture (features, architecture, database, stages, security, design system), see **[PROJECT.md](PROJECT.md)**. For a step-by-step guide to rebuilding a project like this, see **[docs/linqsafe-Build-Guide.pdf](docs/linqsafe-Build-Guide.pdf)**.

## Stages

| Stage | Address | Database | Settings | Branch |
|---|---|---|---|---|
| local | `localhost:5173` | `linqsafe_local` | `.env.local` | usually `dev` |
| dev | `dev.linqsafe.com` | `linqqkto_linqsafe_dev` (cPanel) | `.env` on server | `dev` |
| prod | `linqsafe.com` + `admin.linqsafe.com` | `linqqkto_linqsafe` (cPanel) | `.env` on server | `prod` |

Work on `dev`, check it on dev.linqsafe.com, then merge `dev` into `prod` and deploy. **Full instructions: [docs/DEPLOY.md](docs/DEPLOY.md).**

## Run locally

Requires Node 22 and MySQL 8.

```bash
git switch dev
cp .env.example .env.local   # DB_* for your local MySQL, DB_NAME=linqsafe_local
npm install
npm run dev                  # API :3001, site :5173, founder console admin.localhost:5173
npm run owner                # after signing up with OWNER_EMAIL: verifies it and unlocks every feature
npm test                     # API tests (they clean up after themselves)
```

## Deploy (Namecheap cPanel)

```bash
npm run package:dev   # dev branch  → linqsafe-dev.zip
npm run package       # prod branch → linqsafe-prod.zip
```

Upload and extract the zip into the app folder, then *Setup Node.js App* → **Restart**. Each server keeps its own `.env`. First-time setup, DNS, SSL, Paystack, email, backups and troubleshooting: [docs/DEPLOY.md](docs/DEPLOY.md).

Docker (`docker compose up --build`) and Vercel are still supported as alternatives, but the live site runs on cPanel.

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
