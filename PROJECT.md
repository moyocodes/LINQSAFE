# linqsafe: project guide

linqsafe is a link-in-bio platform. Each person or business gets one page (`linqsafe.com/yourname`) that holds their socials, shop, booking links and contact, with themes, templates, analytics and paid add-on features.

This guide explains what the product does, how it's built, how to run it in each stage, and what's still open.

---

## 1. What the product does

### For visitors (public profile, `/:username`)

- A profile page with photo, name, bio, topics, social badges and links.
- **7 templates**: Classic, Grid, Minimal (free); Cover, Editorial, Search & solve, Profile card (paid).
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

The dashboard has a **Features** checklist. Unlocked features are ticked and show their expiry. Locked ones are struck through, with a price for the chosen period and an **Unlock** button.

**Prices:** each feature has a monthly price in naira, plus optional discounts for 3, 6 and 12 months. The founder sets them in the founder dashboard (_Pricing_), and saved values are stored in `app_settings`. `.env` values (`PRICE_<FEATURE>`, `DISCOUNT_3M/6M/12M`) are the fallback. A feature with no price isn't for sale. The list of features lives in `server/features.js`.

**Payments: Paystack (naira).** "Unlock" starts a Paystack checkout for that feature and period. The feature switches on only after the server verifies the payment with Paystack, on the return page (`/billing/callback`) and again through the signed webhook (`/api/billing/webhook`), so it still works if the buyer closes the tab. Every checkout is recorded in `payments` with a LinqSafe reference and, once verified, how the customer paid (card type and last 4, bank transfer, USSD, bank). The founder dashboard lists payments with method breakdowns, and customers see their own receipts under Features. and access is stored in `user_features` with an `expires_at`. When a feature expires, the page quietly falls back to the free version. `npm run set-plan -- <username> pro` grants every feature with no expiry, for you or for comps.

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
| Hosting               | **Vercel** (frontend + serverless API)                                                       | Main deployment path                                                                             |
| Containers (optional) | **Docker** + Docker Compose                                                                  | Alternative for Docker hosts or running app + MySQL together; not used in local dev or on Vercel |
| Site analytics        | **Vercel Web Analytics** + in-house `events` table                                           | Vercel for site traffic; in-house for each user's page                                           |

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
- **Vercel:** `api/index.js` exports the same Express app as one serverless function. `vercel.json` sends `/api/*` to it and everything else to `index.html`.

### Folder map

```
api/index.js            Vercel serverless entry
server/app.js           all API routes
server/db.js            MySQL connection, runs migrations
server/migrations.js    versioned schema changes (append-only)
server/schema.sql       readable snapshot of the full schema
server/env.js           loads .env.local (your computer) then .env (servers)
app.cjs                 cPanel startup file
scripts/package.sh      builds linqsafe-dev.zip / linqsafe-prod.zip
docs/DEPLOY.md          step-by-step deployment for local, dev, prod
server/mailer.js        Resend email + email template
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
- Work on `dev` → deploy to dev.linqsafe.com → `git merge dev` into `prod` → deploy to linqsafe.com.
- Deploy packages: `npm run package:dev` → `linqsafe-dev.zip`, `npm run package` → `linqsafe-prod.zip`. Each runs as a cPanel *Node.js App* (**Node.js 20+**, startup file `app.cjs`) next to cPanel's MySQL (`DB_HOST=localhost`, user added to the database with all privileges). `npm run check` (cPanel → Run JS script → `check`) diagnoses settings and the database login.
- A LOCAL / DEV badge shows outside prod.
- Vercel (`api/index.js`, `vercel.json`) and Docker remain supported, but aren't used: Namecheap's MySQL only accepts connections from its own server.

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

- **Palette** (`src/styles.css`): beige background, espresso text and primary, **maroon accent** used mostly at low opacity (`bg-accent/10`). Supporting tints: `rose`, `lilac`, `sand`, `mist` (dusty blue). No greens.
- **Section moods:** blush hero → aubergine-night 3D story → dusty-blue showcase → lilac/peach feature cards → wine call-to-action → espresso footer.
- **Fonts:** Bricolage Grotesque (headings), Inter (body), Cormorant Garamond (editorial serif), Allura (signatures), IBM Plex Mono (profile card).
- **Motion:** spring-based hover and press on buttons and cards, scroll reveals, a scroll-clip panel, and the 3D link tree. Everything respects `prefers-reduced-motion`.

### Prompts for matching animations and images

Use these with an AI video or image tool (Meta AI, Runway, Sora, Midjourney). Each keeps to the site palette: beige `#F6F1EA`, espresso `#2A201C`, maroon `#6B2433`, blush `#F2CDD3`, lilac `#DCD5EE`, sand `#E9D6BF`, dusty blue `#B4C4D6`.

1. **Hero loop:** "Slow, seamless 6-second loop of soft blush and lilac light blooms drifting across a warm beige paper background, subtle film grain, gentle parallax, calm and premium, no text, 16:9."
2. **Phone mockup:** "Hand holding a matte maroon phone against a warm beige wall, the screen shows a minimal link-in-bio page with rounded beige buttons, soft daylight, editorial lifestyle photography, shallow depth of field."
3. **Section transition:** "Abstract dusty-blue to sand gradient fog slowly rolling, soft light rays from top right, cinematic, minimal, seamless loop, 10 seconds."
4. **3D link tree:** "Glowing thin lines branching from one rose-gold orb into five pastel orbs (dusty rose, terracotta, dusty blue, sand, lilac) on a deep aubergine night background with faint stars, slow camera orbit, elegant, no text."
5. **Founder's note backdrop:** "Overhead shot of cream textured paper, a paperclip, a polaroid and a maroon fountain pen on a linen tablecloth, warm natural light, quiet luxury aesthetic."
6. **Testimonial bubbles:** "Soft pink chat bubbles floating up and gently bobbing around empty centre space on a warm off-white background, playful but refined, 3D clay style, seamless loop."
7. **Business category covers:** "[beauty studio / bakery / fashion boutique / coaching office] interior in warm beige, blush and espresso tones, soft morning light, editorial, portrait 4:5, space at the bottom for text."

---

## 10. Status and next steps

**Live:** https://linqsafe.com (prod) on Namecheap cPanel, Node.js 22 + cPanel MySQL, deployed 8 Oct 2026. Next: dev.linqsafe.com and admin.linqsafe.com apps, a full live Paystack payment, Resend email.

**Done and tested end to end:** sign-up, log-in by email, httpOnly sessions, log-out, links with type detection, plan limits, analytics (views, unique visitors, clicks, country, device, referrer; owner visits, refreshes and bots excluded), migrations on an existing database.

**Also tested end to end:** free limits (4th link and paid templates refused), features after unlocking, owner dashboard access rules (unverified email and wrong host refused), onboarding completion, last-login tracking, Paystack endpoints refusing unsigned webhooks and missing keys.

**Built but only checked by compiling:** the new templates, onboarding wizard, founder dashboard UI, footer, pricing page and admin subdomain routing need a visual pass in the browser.

**Open:**

- **Payments:** checkout was tested against Paystack's test API (a real checkout page is created with the right amount). A full test payment (pay → callback → feature unlocked → webhook) still needs doing once in the browser, then again on dev with the webhook URL set.
- **Browser tests:** `tests/api.test.js` covers the API (10 tests). A browser smoke test (e.g. Playwright) for onboarding and templates would be the next layer. Sign-ups are rate-limited (30 per 15 minutes), so running `npm test` many times in a row will start failing with 429s.
- **Image storage:** pictures are stored in the database as small data URLs, which is fine at small scale. Move to object storage (Vercel Blob, S3, Cloudinary) as you grow.
