# linqsafe

**One link for everything you share.** Link-in-bio pages for creators and small businesses: one page (`linqsafe.com/yourname`) for your socials, shop, WhatsApp and more, with templates, themes, built-in analytics and pay-per-feature upgrades in naira.

| | |
|---|---|
| Live site | https://linqsafe.com |
| Founder console | https://admin.linqsafe.com |
| Test site | https://dev.linqsafe.com |
| Repo | https://github.com/moyocodes/LINQSAFE |

**Stack:** React 18 · Vite · Tailwind CSS · Framer Motion · GSAP · three.js · Node 22 · Express · MySQL 8 · Paystack · Resend · Namecheap cPanel · GitHub Actions

**Docs:** [PROJECT.md](PROJECT.md) (features, architecture, database, design system) · [docs/DEPLOY.md](docs/DEPLOY.md) (step-by-step hosting, deploys, troubleshooting) · [docs/linqsafe-Build-Guide.pdf](docs/linqsafe-Build-Guide.pdf) (how to build a project like this)

---

## Features

- **Public profile** (`/:username`): photo, bio, topics, social badges, links, WhatsApp button for businesses. 7 templates, 5 themes (incl. auto dark).
- **Dashboard** (`/admin`): onboarding wizard, drag-to-reorder links with platform detection, live phone preview, analytics (views, unique visitors, clicks, countries, sources, devices, best time to post).
- **Paid features**, each bought for 1, 3, 6 or 12 months via **Paystack** (no subscription): unlimited links, premium templates, founder's note, testimonials, QR code, 90-day analytics. The free plan holds 3 links.
- **Founder console** (admin.linqsafe.com): users, activation funnel, revenue, payments, expiries, and a pricing editor.
- **Emails** via **Resend**: confirm, welcome, password reset/changed, receipts, expiry reminders, contact form.
- **SEO**: per-page titles, link previews and structured data (including each profile), generated `robots.txt` and `sitemap.xml`; dev and admin are never indexed.

## Stages

| Stage | Address | Database | Settings file | Branch | Paystack |
|---|---|---|---|---|---|
| **local** | `localhost:5173` | `linqsafe_local` (your computer) | `.env.local` | usually `dev` | test |
| **dev** | dev.linqsafe.com | `linqqkto_linqsafe_dev` (cPanel) | `.env` in `/home/linqqkto/linqsafe-dev` | `dev` | test |
| **prod** | linqsafe.com + admin.linqsafe.com | `linqqkto_linqsafe` (cPanel) | `.env` in `/home/linqqkto/linqsafe` and `…/linqsafe-admin` (same file) | `prod` | live |

Each stage has its own database and settings, so testing never touches real users or money. The server reads `.env.local` first, then `.env` (`server/env.js`). Templates: [`.env.dev.example`](.env.dev.example), [`.env.prod.example`](.env.prod.example), [`.env.example`](.env.example).

## Run locally

Needs Node 22 and MySQL 8.

```bash
git clone https://github.com/moyocodes/LINQSAFE.git linqsafe && cd linqsafe
git switch dev
cp .env.example .env.local     # set DB_* for your local MySQL, DB_NAME=linqsafe_local
npm install
npm run dev                    # API on :3001, site on :5173, founder console on admin.localhost:5173
```

Then sign up with your `OWNER_EMAIL` and run `npm run owner` to verify it and unlock every feature. Tables are created automatically on start (`server/migrations.js`). Without `RESEND_API_KEY`, emails are printed in the terminal.

## Deploy

**Deploys are automatic.** GitHub Actions (`.github/workflows/deploy.yml`) runs on every push:

| Push to | Runs | Goes live on |
|---|---|---|
| `dev` | tests → build (DEV badge) → FTPS upload → restart | dev.linqsafe.com |
| `prod` | tests → build → FTPS upload → restart | linqsafe.com + admin.linqsafe.com |

```bash
# day to day
git switch dev
# …edit, test locally…
git commit -am "Describe the change" && git push            # → dev.linqsafe.com

# release to the live site
git switch prod && git merge dev && git push && git switch dev   # → linqsafe.com + admin
```

- **Check a deploy landed:** open `/version.txt` on the site; it shows the deployed commit.
- A failing test stops the deploy. Server `.env` files, `node_modules` and logs are never touched.
- **New or upgraded packages** (`package.json` dependencies): after the deploy, cPanel → *Setup Node.js App* → each app → **Run JS script → `deps`** → **Restart**. FTP can't install packages.
- GitHub secrets: `FTP_SERVER=server144.web-hosting.com`, `FTP_USERNAME=linqqkto` (the main cPanel FTP account, path `/home/linqqkto`), `FTP_PASSWORD`.
- Manual fallback: `npm run package` / `package:dev` / `package:admin` builds a zip to upload and extract in the app folder.

### Server layout (cPanel, Node.js App)

```
/home/linqqkto/
├── linqsafe/            app for linqsafe.com            (.env = prod)
├── linqsafe-admin/      app for admin.linqsafe.com      (.env = same as prod)
├── linqsafe-dev/        app for dev.linqsafe.com        (.env = dev)
├── admin.linqsafe.com/  subdomain folder: only .htaccess (cPanel's Node block)
├── dev.linqsafe.com/    subdomain folder: only .htaccess
└── public_html/         main domain folder: only .htaccess
```

Each app: Node.js **22**, mode Production, startup file **`app.cjs`**, `DB_HOST=localhost`, database user added to its database with **all privileges**. **Don't delete these folders.** If a site misbehaves: *Run JS script → `check`* prints what's wrong. Full setup and troubleshooting: [docs/DEPLOY.md](docs/DEPLOY.md).

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | API + site with live reload (local) |
| `npm test` | API tests against the running local server; they delete the test accounts they create |
| `npm run build` | Build the site into `dist/` |
| `npm start` | Production server (API + `dist/`) |
| `npm run check` | Self-check: settings found and database login (on cPanel: *Run JS script → `check`*) |
| `npm run deps` | Install server packages (on cPanel: *Run JS script → `deps`*) |
| `npm run owner` | Verify `OWNER_EMAIL` and unlock every feature for it |
| `npm run set-plan -- <username> <free\|pro>` | `pro` unlocks every feature for a user, no expiry |
| `npm run reminders` | Send "ends soon" / "has ended" emails (daily cPanel cron on prod) |
| `npm run email:test -- you@example.com` | Send one real test email to check Resend on this stage (cPanel: *Run JS script → `email:test`*, parameter: your email) |
| `npm run emails:preview` | Write every email template to `email-previews/` to view in a browser |
| `npm run package` / `package:dev` / `package:admin` | Build a deploy zip (manual fallback) |

## Environment variables

Full list with comments in [`.env.example`](.env.example); ready-to-fill versions in [`.env.prod.example`](.env.prod.example) and [`.env.dev.example`](.env.dev.example).

| Setting | Purpose |
|---|---|
| `NODE_ENV=production` | on every server (secure cookies) |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | MySQL; `DB_HOST=localhost` on cPanel |
| `JWT_SECRET` | login sessions; long random, different per stage |
| `APP_URL` | the site's address (links in emails) |
| `OWNER_EMAIL` | the founder account (needs a verified email) |
| `ADMIN_HOST` | prod only: founder console only on `admin.linqsafe.com` |
| `PAYSTACK_SECRET_KEY` `PAYSTACK_PUBLIC_KEY` | test keys on local/dev, live keys on prod (always a matching pair) |
| `RESEND_API_KEY` `MAIL_FROM` `SUPPORT_EMAIL` | sending email and where replies go |
| `PRICE_*` `DISCOUNT_*` | optional default prices; the founder console overrides them |

Never commit real values: `.env` and every `.env.*` file are git-ignored except the examples.

## Project structure

```
src/                 React app (pages, components, lib)
server/app.js        all API routes
server/migrations.js database schema, applied automatically on start
server/seo.js        per-page meta, robots.txt, sitemap.xml
server/emails.js     email templates;  server/mailer.js sends them (Resend)
server/features.js   paid features and pricing
server/scripts/      check, owner, set-plan, reminders, email-preview
app.cjs              cPanel startup file
tests/api.test.js    API tests
.github/workflows/   deploy.yml (GitHub Actions)
docs/                DEPLOY.md, build guide
```

## Accessibility

Skip link, focus moved on navigation with a screen-reader announcement, labelled fields with described errors, visible focus rings, keyboard-reorderable links, and `prefers-reduced-motion` respected by Framer Motion, GSAP and the 3D scene.

## License

© 2026 Moyosore James. **All rights reserved.** The code is public to view only; no permission is granted to copy, reuse or host it. See [LICENSE](LICENSE). Permission requests: support@linqsafe.com.
