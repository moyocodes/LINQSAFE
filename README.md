# Linkhub

Link-in-bio pages. Users sign up, add links, drag to reorder, and share one URL (`/yourname`).
The landing page tells the story with a scroll-driven 3D link tree.

**Stack:** React 18 · Vite · Tailwind CSS · shadcn/ui-style components (Radix) · Framer Motion · GSAP (ScrollTrigger) · Three.js · Express · MySQL

## Pages

| Route | What |
| --- | --- |
| `/` | Landing page with the animated 3D link tree |
| `/signup`, `/login` | Auth (password show/hide, Caps Lock hint) |
| `/admin` | Dashboard: profile, links, drag/keyboard reorder, click counts, live preview |
| `/:username` | Public profile |
| `/contact` | Contact form (stored in the `contact_messages` table) |
| `/terms`, `/privacy` | Legal pages |

## Run locally

Requires Node 20+ and a running MySQL.

```bash
cp .env.example .env      # then edit DB_* and JWT_SECRET
npm install
npm run dev               # API on :3001, Vite on :5173
```

Tables (and the database, if your user may create it) are created automatically on first start.

## Customise

- **Brand, support email, legal dates:** `src/config.js`
- **Colours and radius:** CSS variables at the top of `src/styles.css`
- **Tree nodes/questions on the landing page:** `BRANCHES` and `STEPS` in `src/components/TreeStory.jsx`
- **Terms / Privacy:** `src/pages/Terms.jsx`, `src/pages/Privacy.jsx` are sensible templates, not legal advice. Have them reviewed for your jurisdiction and edit them to match what you actually collect.

## Deploy

One process serves both the API and the built frontend, so there is only one thing to host.

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

In production the server **refuses to start without a real `JWT_SECRET`**
(`openssl rand -hex 32`).

### Environment variables

| Var | Notes |
| --- | --- |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | MySQL connection |
| `DB_SSL` | `true` for hosted MySQL that requires TLS |
| `JWT_SECRET` | Required in production |
| `PORT` | Most hosts set this for you |
| `CORS_ORIGIN` | Only if the frontend is on a different origin |

### Render / Railway / Fly / any Node host

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Add the env vars above and a MySQL database (Railway MySQL, Aiven, PlanetScale, RDS…).
- Health check path: `/api/health`

### Docker

```bash
docker build -t linkhub .
docker run -p 3001:3001 --env-file .env linkhub
```

### Before you go live

- [ ] Strong `JWT_SECRET` set
- [ ] HTTPS enabled (most hosts do this automatically)
- [ ] `src/config.js` email and company name updated
- [ ] Terms and Privacy reviewed
- [ ] Check new contact messages: `SELECT * FROM contact_messages ORDER BY created_at DESC;`
- [ ] Database backups enabled

### Notes

- Security headers (helmet/CSP), gzip, rate limiting on auth, contact and the API are built in.
- Usernames that clash with pages (`admin`, `contact`, `terms`, …) are reserved.
- The sign-in token lives in `localStorage` (7-day expiry). For higher-security needs, move to httpOnly cookies.
- Add a `sitemap.xml` and OG image to `public/` once you have a domain.

## Accessibility

Skip link, focus moved to the page on navigation with a screen-reader announcement, labelled form fields with
described errors, visible focus rings, keyboard-reorderable links (not just drag), `prefers-reduced-motion`
respected by Framer Motion, GSAP and the 3D scene (it renders a static tree with the questions as plain cards).
