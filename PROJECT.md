# linqsafe: project guide

linqsafe is a link-in-bio platform. Each person or business gets one page (`linqsafe.com/yourname`) that holds their socials, shop, booking links and contact, with themes, templates, analytics and paid add-on features.

This guide explains what the product does, how it's built, how to run it in each stage, and what's still open.

---

## 1. What the product does

### For visitors (public profile, `/:username`)

- A profile page with photo, name, bio, topics, social badges and links.
- **8 templates**: Classic, Grid, Minimal (free); Cover, Editorial, Search & solve, Photo background (blurred or sharp), Profile card (paid).
- **5 themes**: Light, Sage, Blush, Midnight, Auto (follows the visitor's light/dark setting).
- Business pages can show a **Chat on WhatsApp** button.
- Pages can show a **Founder's note** (paid) (paper-style letter with signature) and **Kind words** (client testimonials as chat bubbles).

### For page owners (dashboard, `/admin`)

- **Onboarding** after the first login: account type (personal or business), business category and optional WhatsApp, profile basics, socials, template.
- Add, edit, drag-to-reorder and delete links. Pasting a URL detects the platform (Instagram, TikTok, YouTube, and others). Unknown URLs ask for a type.
- Social link suggestions (one tap to start an Instagram, TikTok, … link).
- Profile picture and cover photo upload (cropped and resized in the browser).
- Live phone preview with a toolbar (Open, Copy, Share, QR, Stats). On phones it opens as a slide-up sheet.
- **Analytics** (`/admin/analytics`): views, unique visitors, clicks, click-through rate, daily chart, top links, countries, referrers, devices.
- Email verification, forgot/reset password, log in with username or email.

### For the founder (`/owner`, or the `admin.` subdomain)

- Whole-site numbers: users, signups per day, paying users, revenue, business counts, traffic, top pages, countries, business categories, templates in use, latest signups with last login, contact messages.
- Only the `OWNER_EMAIL` account can open it, and only after that email is verified.

### Free and paid features

Everyone gets a free page. On top of that, each extra feature is **bought separately for 1, 3, 6 or 12 months**: no subscription and no bundle. Buying again adds time to what's left.

| Free                                                             | Paid features (each sold on its own)                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Up to 3 links                                                    | Unlimited links                                                                  |
| Classic, Grid, Minimal templates                                 | Cover, Editorial, Search & solve, Profile card templates (one purchase each)     |
| All themes, WhatsApp button, analytics for the last 7 or 30 days | Founder's note · Kind words (testimonials) · QR code download · 90-day analytics |

Each paid feature shows its own price and an **Add** button right where it lives on the dashboard (template cards, Founder's note, Kind words, QR code, the links limit, analytics). Added features collect in a cart bar at the bottom: pick 1/3/6/12 months, see the total, and pay for all of them in **one Paystack payment** (`payments.items` records each feature, months and price). Receipts list every feature bought.

**Prices:** each feature has a monthly price in naira, plus optional discounts for 3, 6 and 12 months. The founder sets them in the founder dashboard (_Pricing_), and saved values are stored in `app_settings`. `.env` values (`PRICE_<FEATURE>`, `DISCOUNT_3M/6M/12M`) are the fallback. A feature with no price isn't for sale. The list of features lives in `server/features.js`.

**Payments: Paystack (naira).** "Unlock" creates the checkout on the server and opens it in Paystack's inline popup (`@paystack/inline-js`, `resumeTransaction`) on the same page, falling back to Paystack's full page if the popup can't load. The feature switches on only after the server verifies the payment with Paystack, on the return page (`/billing/callback`) and again through the signed webhook (`/api/billing/webhook`), so it still works if the buyer closes the tab. Every checkout is recorded in `payments` with a LinqSafe reference and, once verified, how the customer paid (card type and last 4, bank transfer, USSD, bank). The founder dashboard lists payments with method breakdowns, and customers see their own receipts under Features. and access is stored in `user_features` with an `expires_at`. When a feature expires, the page quietly falls back to the free version. `npm run set-plan -- <username> pro` grants every feature with no expiry, for you or for comps.

Limits are enforced on the server (`server/app.js`) as well as in the UI.

---

## 2. Tech stack

| Layer                 | Tool                                                                                         | Why                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Frontend              | **React 18** + **Vite 5**                                                                    | Fast dev server, simple build to static files                                                    |
| Routing               | React Router 6                                                                               | `/:username` profiles plus app pages                                                             |
| Styling               | **Tailwind CSS 3** + CSS variables                                                           | Design tokens in `src/styles.css`; shadcn-style UI components in `src/components/ui`             |
| Animation             | **Framer Motion** (UI), **GSAP ScrollTrigger** (scroll-clip section), **three.js** (3D tree) | Motion respects "reduce motion" settings                                                         |
| Icons                 | lucide-react                                                                                 | Consistent line icons                                                                            |
| Backend               | **Node 22** + **Express 4**                                                                  | JSON API under `/api`                                                                            |
| Database              | **MySQL 8** (`mysql2`)                                                                       | Versioned migrations in `server/migrations.js`                                                   |
| Auth                  | bcrypt passwords, JWT in an **httpOnly cookie**                                              | Scripts can't read the session; SameSite=Lax blocks CSRF                                         |
| Email                 | **Resend** HTTP API                                                                          | Verify and reset emails; printed to the console in local dev                                     |
| Payments              | **Paystack**                                                                                 | Naira checkout, server-side verification, signed webhook                                         |
| QR codes              | `qrcode`                                                                                     | Generated in the browser                                                                         |
| Hosting | **Namecheap cPanel** Node.js App (Passenger/LiteSpeed) + cPanel MySQL | Live site; deployed by GitHub Actions over FTPS; Docker remains as an alternative |
| CI/CD | **GitHub Actions** (free) | Tests, builds and FTPS-deploys `dev` → dev.linqsafe.com, `prod` → linqsafe.com + admin |
| Containers (optional) | **Docker** + Docker Compose                                                                  | Alternative for Docker hosts or running app + MySQL together; not used in local dev or on cPanel |
| Site analytics | In-house `events` table (no third-party trackers) | Each user's page analytics and the founder dashboard |

---

## 3. How it fits together

```
Browser (React SPA)
  │  fetch /api/*  (cookie: lh_session, lh_vid)
  ▼
Express app  (server/app.js)
  ├─ auth: register, login, logout, verify email, forgot/reset password
  ├─ owner API: /api/me, /api/profile, /api/links, /api/note, /api/testimonials, /api/onboarding
  ├─ public API: /api/u/:username (records a view), /api/click/:id (records a click)
  ├─ analytics: /api/analytics (per user), /api/owner/stats (founder only)
  └─ MySQL (server/db.js → migrations run on start)
```

- **Local, Node hosts and Docker:** `server/index.js` starts Express, which also serves the built frontend from `dist/`.

### Folder map

```
server/app.js           all API routes
server/db.js            MySQL connection, runs migrations
server/migrations.js    versioned schema changes (append-only)
server/schema.sql       readable snapshot of the full schema
server/env.js           loads .env.local (your computer) then .env (servers)
server/seo.js           per-page titles, previews, structured data, robots.txt, sitemap.xml
app.cjs                 cPanel startup file
scripts/package.sh      builds linqsafe-dev.zip / linqsafe-prod.zip
docs/DEPLOY.md          step-by-step deployment for local, dev, prod
.github/workflows/      deploy.yml: test, build and FTPS-deploy on push to dev/prod
server/mailer.js        sends email through Resend (or prints it without a key)
server/emails.js        all email templates (HTML + plain text)
server/scripts/reminders.js  daily "ends soon" / "has ended" emails (cron)
server/scripts/         set-plan.js, owner.js
tests/api.test.js       API tests (npm test)
Dockerfile              production image (optional hosting path)
docker-compose.yml      app + MySQL in containers (optional)
src/pages/              Home, Auth, Admin, Analytics, Owner, Pricing, Profile, …
src/components/         Layout, hero, feature grid, templates, pickers, 3D tree
src/lib/                linkTypes (platform detection), plans, stage, motion presets
```

---

## 4. Data model

The full schema is in [`server/schema.sql`](server/schema.sql). The main tables:

- **users**: login (username, email, password hash, `email_verified`, `token_version`), public profile (display name, bio, avatar, cover, tags, occupation, location), look (`layout`, `theme`), business (`account_type`, `category`, `whatsapp`), paid content (`note_body`, `note_sign`, `testimonials`), `plan` (`pro` = everything, set by hand), activity (`views`, `last_login_at`, `login_count`, `onboarded_at`).
- **payments**: one row per checkout. `reference` is our LinqSafe reference (`LQS-…`), also sent to Paystack as its reference. It also stores Paystack's transaction ID, amount (kobo), feature, months, status (`initialized` → `success` / `abandoned` / `failed`), how they paid (`channel`, card type and last 4, bank), the customer email and Paystack's response.
- **user_features**: which paid features each user has, with `expires_at` (NULL = no expiry).
- **app_settings**: founder-editable settings (feature prices and discounts).
- **links**: `user_id`, `title`, `url`, `type`, `position`, `clicks`.
- **events**: one row per view or click: `user_id`, `link_id`, `kind`, `referrer` (domain only), `device`, `country`, `visitor` (random cookie id). No IP addresses or user agents are stored.
- **auth_tokens**: one-time verify and reset tokens, stored as SHA-256 hashes with an expiry.
- **contact_messages**: contact form submissions.
- **schema_migrations**: which migrations have run.

**To change the schema:** append a new step to `MIGRATIONS` in `server/migrations.js` with the next number. Never edit or reorder old steps. Then refresh `schema.sql`:

```
mysqldump -u root -p --no-data linktree > server/schema.sql
```

---

## 5. Stages: local, dev, prod

Full step-by-step instructions: **[docs/DEPLOY.md](docs/DEPLOY.md)**.

| Stage | Where | Address | Database | Settings | Branch | Paystack |
|---|---|---|---|---|---|---|
| **local** | your computer | `localhost:5173` | `linqsafe_local` | `.env.local` | any (usually `dev`) | test |
| **dev** | Namecheap cPanel | `dev.linqsafe.com` | `linqqkto_linqsafe_dev` | `.env` on the server | `dev` | test |
| **prod** | Namecheap cPanel | `linqsafe.com`, `admin.linqsafe.com` | `linqqkto_linqsafe` | `.env` on the server | `prod` | live |

- Each stage has its own database and settings; the server reads `.env.local` first, then `.env` (`server/env.js`). Only your computer has `.env.local`.
- Work on `dev` → push (GitHub Actions deploys dev.linqsafe.com) → `git merge dev` into `prod` → push (deploys linqsafe.com + admin). Free CI/CD: `.github/workflows/deploy.yml`.
- Deploy packages: `npm run package:dev` → `linqsafe-dev.zip`, `npm run package` → `linqsafe-prod.zip`. Each runs as a cPanel *Node.js App* (**Node.js 20+**, startup file `app.cjs`) next to cPanel's MySQL (`DB_HOST=localhost`, user added to the database with all privileges). `npm run check` (cPanel → Run JS script → `check`) diagnoses settings and the database login.
- A LOCAL / DEV badge shows outside prod.
- Docker remains supported as an optional alternative.

## 6. Environment variables

| Variable                                                       | Where            | Purpose                                                                |
| -------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` `DB_SSL` | server           | MySQL connection                                                       |
| `JWT_SECRET`                                                   | server           | Signs session cookies. **Required in production**                      |
| `PORT`                                                         | server           | Local API port (3001)                                                  |
| `APP_URL`                                                      | server           | Base URL for links in emails                                           |
| `RESEND_API_KEY` `MAIL_FROM`                                   | server           | Sending email                                                          |
| `OWNER_EMAIL`                                                  | server           | Founder dashboard access                                               |
| `ADMIN_HOST`                                                   | server           | Locks the founder API to the admin subdomain                           |
| `PAYSTACK_SECRET_KEY`                                          | server           | Paystack API + webhook signature check                                 |
| `PRICE_<FEATURE>`                                              | server           | Default monthly price per feature (naira); founder dashboard overrides |
| `DISCOUNT_3M` `DISCOUNT_6M` `DISCOUNT_12M`                     | server           | Default % off for longer periods                                       |
| `PAYSTACK_PUBLIC_KEY`                                          | frontend         | Only needed for Paystack's in-page popup (not used yet)                |
| `CORS_ORIGIN`                                                  | server           | Only if the frontend is on a different origin                          |
| `APP_STAGE`                                                    | frontend (build) | `local` / `dev` / `prod` badge                                         |
| `ADMIN_HOST`                                                   | frontend (build) | Custom founder hostnames (optional)                                    |

---

## 7. Scripts

| Command                                      | Does                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run dev`                                | API + site with live reload                                                         |
| `npm run build`                              | Builds the frontend into `dist/`                                                    |
| `npm start`                                  | Production server (serves API + `dist/`)                                            |
| `npm run set-plan -- <username> <free\|pro>` | Change a plan by hand                                                               |
| `npm run owner`                              | Verify the owner email and unlock every feature (local setup)                       |
| `npm test`                                   | API tests against the running dev server (`API_URL` to point elsewhere; never prod) |

---

## 7b. SEO and link previews

linqsafe is a single-page app, so the server fills in each page's `<head>` before sending it (`server/seo.js`, between the `<!--seo-->` markers in `index.html`). Crawlers and chat apps that don't run JavaScript (WhatsApp, X, Facebook, LinkedIn, Slack) see the right preview.

| What | Where |
|---|---|
| Title, description, canonical URL | every page; profiles use `Name (@username) · linqsafe` and their bio |
| Share image (Open Graph / Twitter card) | `public/og-image.png` (1200×630); profiles use their own picture (uploaded pictures are served from `/api/u/:username/avatar`) |
| Structured data (JSON-LD) | home: `WebSite` + `Organization`; profiles: `ProfilePage` with a `Person` or `Organization` (business accounts) and their social links as `sameAs` |
| `robots.txt` | generated; blocks `/admin`, `/owner`, `/api/`, `/billing/`, password and verify pages; points to the sitemap |
| `sitemap.xml` | generated live: the public pages plus every profile with at least one link |
| No indexing on dev and admin | `dev.*` and `admin.*` hosts get `Disallow: /` and an `X-Robots-Tag: noindex` header |
| Private pages | `noindex, nofollow`; unknown usernames return a real 404 |
| Icons | `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192/512.png`, `site.webmanifest` |

## 8. Security notes

- Passwords are bcrypt-hashed. Sessions are httpOnly, SameSite=Lax cookies, Secure in production.
- A password reset signs out every other session (`token_version`).
- Signing up with an email that an _unverified_ account holds releases it to the new signup, so nobody can squat someone else's email.
- Social badges must match the URL's real domain (no "Instagram" badge on a phishing page).
- The anonymous visitor cookie (`lh_vid`) is only set after a visitor accepts the cookie notice. Without consent, views are still counted, just not as unique visitors.
- Rate limits: auth 30 per 15 minutes, clicks 30 per minute, contact 5 per hour, API 300 per minute.
- The security policy (CSP) allows images from `https:` and `data:` only, plus the site's own scripts.

---

## 9. Design system

- **Palette** (`src/styles.css` tokens + fixed brand colours in `tailwind.config.js`, all usable with opacity, e.g. `bg-cobalt/20`, `text-ink/60`):
  - neutrals: paper `#F6F3EE` (background), ink `#261F1C` (text), card `#FCFAF8`
  - accent: **cobalt** `#2B4FAF` (buttons, links, highlights)
  - supporting tints: coral `#F2A07E` (`rose`), teal `#6CC3BA` (`lilac`), sand `#E5D2BD`, blue `#93ACCF` (`mist`)
  - contrast pop: **saffron** `#D99A2B`, used sparingly (live indicators, active markers)
  - night `#170C15` / plum `#3A1C33` for the dark 3D section; maroon `#77313F` as a secondary accent
- **Text hierarchy by ink opacity:** headings 100%, body ~88%, secondary 60%, labels 55% (not separate greys), so it sits right on every surface and theme.
- **Section moods:** warm paper hero → night "workshop" (3D tree flowing into the scroll-clip showcase) → paper feature cards → cobalt call-to-action → espresso footer.
- **Fonts (three families):** **Fraunces** (headings, serif with soft italics), **DM Sans** (body and UI), **IBM Plex Mono** (labels, eyebrows, codes). Allura is used only for founder's-note signatures.
- **Surfaces:** "paper" cards with fine grain, a hairline edge and a long soft shadow; small corners (`--radius: 0.375rem`); inputs warm to the accent on focus.
- **Motion:** spring hover/press on buttons and cards, scroll reveals, word-by-word hero headline, looping phone story, a GSAP scroll-clip panel, the 3D link tree, live analytics bars. Everything respects `prefers-reduced-motion`.

### Prompts for matching animations and images

Use these with an AI video or image tool (Meta AI, Runway, Sora, Midjourney). Each keeps to the site palette: paper `#F6F3EE`, ink `#261F1C`, cobalt `#2B4FAF`, coral `#F2A07E`, teal `#6CC3BA`, sand `#E5D2BD`, saffron `#D99A2B`, night `#170C15`.

1. **Hero loop:** "Slow, seamless 6-second loop of soft coral, teal and saffron light blooms drifting across a warm paper background, subtle film grain, gentle parallax, calm and premium, no text, 16:9."
2. **Phone mockup:** "Hand holding a matte cobalt-blue phone against a warm paper-white wall, the screen shows a minimal link-in-bio page with rounded beige buttons, soft daylight, editorial lifestyle photography, shallow depth of field."
3. **Section transition:** "Abstract dusty-blue to sand gradient fog slowly rolling, soft light rays from top right, cinematic, minimal, seamless loop, 10 seconds."
4. **3D link tree:** "Glowing thin lines branching from one rose-gold orb into five pastel orbs (coral, cobalt, teal, sand, saffron) on a deep night-plum background (#170C15) with faint stars, slow camera orbit, elegant, no text."
5. **Founder's note backdrop:** "Overhead shot of cream textured paper, a paperclip, a polaroid and a cobalt fountain pen on a linen tablecloth, warm natural light, quiet luxury aesthetic."
6. **Testimonial bubbles:** "Soft coral and cobalt chat bubbles floating up and gently bobbing around empty centre space on a warm off-white background, playful but refined, 3D clay style, seamless loop."
7. **Business category covers:** "[beauty studio / bakery / fashion boutique / coaching office] interior in warm paper-white, cobalt and coral tones, soft morning light, editorial, portrait 4:5, space at the bottom for text."

---

## 10. Status and next steps

**Live (8 Oct 2026):**
- **prod** https://linqsafe.com on Namecheap cPanel (Node.js 22 + cPanel MySQL).
- **dev** https://dev.linqsafe.com running on its own database.
- **admin** https://admin.linqsafe.com founder console (prod database).
- **CI/CD:** GitHub Actions tests, builds and deploys on every push to `dev` / `prod`; verified via `/version.txt` on all three sites.

**Tested end to end (API tests, run locally and in GitHub Actions):** sign-up, log-in by email, httpOnly sessions, log-out, links with type detection, free limits and paid-feature locks, business profile and WhatsApp validation, onboarding, analytics (views, unique visitors, clicks, country, device, referrer; owner visits, refreshes and bots excluded), founder-dashboard lockout, Paystack refusing unsigned webhooks.

**Tested by hand:** Paystack checkout creation against Paystack's test API (real checkout page, `LQS-` reference, abandoned status recorded); the cPanel package starting under Node 22; SEO output (robots, sitemap, per-page and profile meta, noindex on dev/admin).

**Not yet seen in a browser:** the Paystack inline popup, onboarding wizard, premium templates, founder dashboard charts.

**Open:**
- **Payments:** one full test payment on dev (popup → paid → feature unlocked → webhook), then live keys (`sk_live_` + `pk_live_`) on prod once Paystack activates live mode.
- **Email:** templates and sending are built; verify linqsafe.com in Resend, add `RESEND_API_KEY` on dev and prod, create `support@linqsafe.com`, and add the daily reminders cron (DEPLOY.md → Email).
- **Search:** submit `sitemap.xml` in Google Search Console.
- **Browser tests:** a Playwright smoke test for onboarding and templates would be the next layer. Sign-ups are rate-limited (30 per 15 minutes), so running `npm test` many times in a row hits 429s.
- **Image storage:** pictures are stored in the database as small data URLs, fine at small scale; move to object storage (S3, Cloudinary) as you grow.
