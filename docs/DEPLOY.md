# Deploying linqsafe

**Status (8 Oct 2026):** prod is live at https://linqsafe.com on Namecheap cPanel (Node.js 22, cPanel MySQL). dev.linqsafe.com and admin.linqsafe.com are set up as domains; their apps are next.

The single, step-by-step reference for running linqsafe on your computer (**local**), on the test site (**dev**) and on the live site (**prod**).

- [1. The three stages](#1-the-three-stages)
- [2. Git branches and workflow](#2-git-branches-and-workflow)
- [3. Local setup](#3-local-setup)
- [4. Server setup on Namecheap (first time)](#4-server-setup-on-namecheap-first-time)
- [5. Deploying an update](#5-deploying-an-update)
- [6. Going live with payments and email](#6-going-live-with-payments-and-email)
- [7. Backups and rollback](#7-backups-and-rollback)
- [8. Troubleshooting](#8-troubleshooting)
- [9. Settings reference](#9-settings-reference)

---

## 1. The three stages

Each stage has its **own database** and **own settings**, so testing never touches real users or real money.

| | **local** | **dev** | **prod** |
|---|---|---|---|
| Purpose | building and trying things | checking a change on a real server | real users and payments |
| Runs on | your computer | Namecheap cPanel | Namecheap cPanel |
| Address | `localhost:5173` | `dev.linqsafe.com` | `linqsafe.com` |
| Founder console | `admin.localhost:5173` | `admin-dev.linqsafe.com` (optional) | `admin.linqsafe.com` |
| Database | `linqsafe_local` (MySQL on your computer) | `linqqkto_linqsafe_dev` (cPanel) | `linqqkto_linqsafe` (cPanel) |
| Settings file | `.env.local` | `.env` in `/home/linqqkto/linqsafe-dev` | `.env` in `/home/linqqkto/linqsafe` and `/home/linqqkto/linqsafe-admin` |
| Git branch | any, usually `dev` | `dev` | `prod` |
| Deploy package | — | `npm run package:dev` → `linqsafe-dev.zip` | `npm run package` → `linqsafe-prod.zip`; founder console: `npm run package:admin` → `linqsafe-admin.zip` |
| Paystack keys | test (`sk_test_`, `pk_test_`) | test | live (`sk_live_`, `pk_live_`) |
| Corner badge | LOCAL | DEV | none |
| Emails | printed in the terminal | sent (or in the app log if no Resend key) | sent |

**How the server picks its settings** (`server/env.js`): it reads `.env.local` first, then `.env`; the first value found wins. Only your computer has `.env.local`. The servers only have `.env`.

> **Rule:** never keep live database passwords or live Paystack keys in any file on your computer. They belong only in the prod `.env` on the server.

`.env`, `.env.local` and every other `.env.*` file are ignored by git (only `.env.example` is committed), and the deploy zips never include them.

---

## 2. Git branches and workflow

| Branch | Is | Deploys to |
|---|---|---|
| `dev` | work in progress that should run | dev.linqsafe.com |
| `prod` | exactly what's live | linqsafe.com + admin.linqsafe.com |
| `feature/...` (optional) | one change at a time | nowhere (local only) |

```
feature/new-thing ──merge──► dev ──merge──► prod
       local            dev.linqsafe.com    linqsafe.com
```

**Day to day**

```bash
git switch dev
git pull
# …make changes, run locally…
npm test
git add -A && git commit -m "Describe the change"
git push
```

**Promote to the live site** (only after it works on dev.linqsafe.com):

```bash
git switch prod
git pull
git merge dev
git push
npm run package        # build linqsafe-prod.zip from the prod branch
git switch dev         # go back to working on dev
```

**Hotfix on live:** fix on `prod`, deploy, then bring it back into dev with `git switch dev && git merge prod`.

**Recommended on GitHub** (repo → Settings): set the default branch to `dev`, and under *Branches* add a rule for `prod` that blocks force-pushes.

---

## 3. Local setup

**Needs:** Node.js 22 (`nvm install 22`), MySQL 8 (`brew install mysql && brew services start mysql`), Git.

1. Get the code and dependencies:
   ```bash
   git clone https://github.com/moyocodes/linktree.git linqsafe
   cd linqsafe
   git switch dev
   npm install
   ```
2. Create your local settings:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local`:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your-local-mysql-password
   DB_NAME=linqsafe_local
   JWT_SECRET=any-long-random-text
   VITE_APP_STAGE=local
   OWNER_EMAIL=moyosorejames@gmail.com
   PAYSTACK_SECRET_KEY=sk_test_...
   PAYSTACK_PUBLIC_KEY=pk_test_...
   ```
3. Start everything:
   ```bash
   npm run dev
   ```
   The API runs on `:3001` and the site on `http://localhost:5173`. The database `linqsafe_local` and all tables are created on the first start (`Applying migration …` lines in the terminal).
4. Sign up at `localhost:5173/signup` with `OWNER_EMAIL`, then:
   ```bash
   npm run owner
   ```
   This verifies that email and unlocks every feature, so you can open the founder console at `localhost:5173/owner` or `admin.localhost:5173`.
5. Run the tests (with `npm run dev` still running):
   ```bash
   npm test
   ```
   They create `qa_…` accounts and delete them when they finish.

**Copying a database between stages** (for example, prod data into local to debug, never the other way round):
cPanel → *phpMyAdmin* → select the database → *Export* → *Quick* → *SQL* → **Go**. Then on your computer:
```bash
mysql -u root -p linqsafe_local < linqqkto_linqsafe.sql
```
Real users' data is then on your computer: delete the file when you're done.

---

## 4. Server setup on Namecheap (first time)

Do this **once for dev** and **once for prod**. Below, values are given as *dev / prod*.

### 4.1 Point the domain at the hosting

1. Namecheap → **Domain List** → **linqsafe.com** → **Manage**.
2. **Nameservers** → choose **Namecheap Web Hosting DNS** (this sets `dns1.namecheaphosting.com` and `dns2.namecheaphosting.com`) → ✓ save.
3. Remove linqsafe.com from any Vercel project.

DNS usually updates within 30 minutes (up to 48 h). With these nameservers cPanel manages all records, including subdomains.

*Using Advanced DNS instead?* Add `A` records for `@`, `www`, `dev` and `admin` pointing to the shared IP shown in cPanel (*General Information → Shared IP Address*), and delete old Vercel records (`76.76.21.21`, `cname.vercel-dns.com`). Keep any `MX`/`TXT` records for email.

### 4.2 Create the subdomains

cPanel → **Domains** → **Create A New Domain**:
- `dev.linqsafe.com` (for dev)
- `admin.linqsafe.com` (for prod's founder console)
- optionally `admin-dev.linqsafe.com`

Untick *Share document root*. The folder cPanel suggests doesn't matter: the Node app replaces it.

### 4.3 Create the database

cPanel → **MySQL Databases**:
1. *Create New Database*: `linqsafe_dev` / `linqsafe` → becomes `linqqkto_linqsafe_dev` / `linqqkto_linqsafe`.
2. *Add New User*: e.g. `lqdev` / `lqprod`, with a generated password (save it in your password manager).
3. *Add User To Database*: pick the user and database → **Add** → tick **ALL PRIVILEGES** → *Make Changes*.
   **Don't skip this.** Without it the login works but the database refuses the user (`ER_DBACCESS_DENIED_ERROR`).

Use a **different user and password** for dev and prod.

### 4.4 Build the package on your computer

```bash
git switch dev  && git pull && npm run package:dev    # → linqsafe-dev.zip
git switch prod && git pull && npm run package        # → linqsafe-prod.zip
npm run package:admin                                  # → linqsafe-admin.zip (founder console)
```

Each zip (~0.5 MB) contains `app.cjs`, `package.json`, `package-lock.json`, `server/` and the built site in `dist/`. No settings files.

### 4.5 Upload

cPanel → **File Manager**:
1. In `/home/linqqkto`, **+ Folder**: `linqsafe-dev` / `linqsafe` (and `linqsafe-admin` for prod). **Not** inside `public_html`.
2. Open the folder → **Upload** → choose the zip → back to the folder → right-click the zip → **Extract** → into the same folder.
3. Delete the zip.

### 4.6 Settings file

In the app folder: **+ File** → name it `.env` → right-click → **Edit**. (Turn on *Settings → Show Hidden Files* to see it later.)

```env
NODE_ENV=production

# Database from step 4.3. DB_HOST must be localhost: cPanel MySQL users can only log in from
# localhost, so the server's IP (e.g. 162.213.255.27) gives ER_ACCESS_DENIED_ERROR.
DB_HOST=localhost
DB_PORT=3306
DB_USER=linqqkto_lqdev              # prod: linqqkto_lqprod
DB_PASSWORD=...
DB_NAME=linqqkto_linqsafe_dev       # prod: linqqkto_linqsafe

# Long random text, different on each stage: openssl rand -hex 32
JWT_SECRET=...

APP_URL=https://dev.linqsafe.com    # prod: https://linqsafe.com
OWNER_EMAIL=moyosorejames@gmail.com
ADMIN_HOST=admin-dev.linqsafe.com   # prod: admin.linqsafe.com  (leave out if you don't use the admin subdomain)

PAYSTACK_SECRET_KEY=sk_test_...     # prod: sk_live_...
PAYSTACK_PUBLIC_KEY=pk_test_...     # prod: pk_live_...

RESEND_API_KEY=re_...               # optional, see section 6
MAIL_FROM=linqsafe <support@linqsafe.com>
```

For prod's `linqsafe-admin` folder, use **exactly the same `.env` as prod** (same database and `JWT_SECRET`).

Prices are easiest to set later in the founder dashboard (*Pricing*). You can also add defaults here (`PRICE_UNLIMITED_LINKS=2000`, … see `.env.example`).

### 4.7 Create the Node.js app

cPanel → **Setup Node.js App** → **Create Application**:

| Field | dev | prod | prod founder console |
|---|---|---|---|
| Node.js version | **newest offered, 20 or higher** (linqsafe.com runs on 22) | same | same |
| Application mode | Production | Production | Production |
| Application root | `linqsafe-dev` | `linqsafe` | `linqsafe-admin` |
| Application URL | `dev.linqsafe.com` | `linqsafe.com` | `admin.linqsafe.com` |
| Application startup file | `app.cjs` | `app.cjs` | `app.cjs` |

Click **Create**. On the app's page click **Run NPM Install** (wait for it to finish), then **Restart**.

> **Check the Node.js version.** cPanel may default to **Node.js 10**, which can't run linqsafe at all: `stderr.log` then fills with `Error: Not supported … app.cjs:4`. Change the version, **Save**, **Run NPM Install** again (changing the version resets the packages), **Restart**.

> **Run JS script** is only for `check` (below). `dev`, `build`, `package`, `test`, `start`, `server`, `preview` are commands for your computer; on the server they fail (`exit code 127`) or start a second copy that cPanel can't stop.

### 4.8 Check it works

**Self-check (no Terminal needed):** *Setup Node.js App* → the app → **Run JS script** → scroll to the bottom → **`check`** → **Run**. It prints the settings it found (never the password, only its length) and whether the database login works. A healthy result:

```
Node.js v22.23.3  ·  NODE_ENV=production
OK   .env file in /home/linqqkto/linqsafe
OK   built website (dist/index.html)
OK   JWT_SECRET set (16+ characters)
     DB_HOST=localhost  DB_PORT=3306  DB_USER=linqqkto_…  DB_NAME=linqqkto_…  DB_PASSWORD=(n characters)
OK   database login works (MySQL …, n tables)
```

Every `FAIL` line is followed by the fix. If `check` isn't in the list, the server has old files: upload the newest zip and refresh the page.

**Then in the browser:**

1. `https://dev.linqsafe.com/api/health` (prod: `https://linqsafe.com/api/health`) shows `{"ok":true}`.
2. The home page loads, with a **DEV** badge on dev and none on prod.
3. Sign up with `OWNER_EMAIL`, then confirm your email from the email you receive (or ask your terminal: see *Owner access* below).
4. Open the founder console: `admin-dev.linqsafe.com` / `admin.linqsafe.com` (or `/owner` if you didn't set `ADMIN_HOST`).

**Owner access without email:** *Setup Node.js App* → the app → **Run JS script** → **`owner`** → **Run**. It verifies `OWNER_EMAIL` and unlocks every feature. (If your plan has cPanel → **Terminal**, you can also paste the `source /home/linqqkto/nodevenv/…` command shown at the top of the app page, then run `npm run owner`.)

### 4.9 HTTPS

cPanel → **SSL/TLS Status** → make sure `linqsafe.com`, `www`, `dev` and `admin` are ticked → **Run AutoSSL**. Certificates usually appear within a few hours. Login cookies need HTTPS on dev and prod.

### 4.10 What goes in `public_html`

Nothing of linqsafe. The Node app serves the whole site from its own folder (`/home/linqqkto/linqsafe`).

- **Keep** `public_html/.htaccess`: cPanel adds a block marked `CLOUDLINUX PASSENGER CONFIGURATION … DO NOT REMOVE` that sends visitors to the Node app. Never edit or delete it.
- **Keep** `.well-known/` (SSL validation) and `cgi-bin/` if present.
- **Delete** any `index.html`, `index.php`, `assets/`, `favicon.svg`, `robots.txt` or old site files: files in `public_html` can be served instead of the app.

The same applies to the `admin.linqsafe.com` and `dev.linqsafe.com` folders cPanel creates in your home directory.

### 4.11 What the app folder should contain

```
/home/linqqkto/linqsafe
├── .env               your settings (only here, never in git or the zip)
├── app.cjs            startup file
├── dist/              the built website
├── server/            the API
├── node_modules       a link cPanel creates on "Run NPM Install"
├── package.json       should say "name": "linqsafe"
├── package-lock.json
└── stderr.log         errors (created by cPanel)
```

Delete the uploaded zip after extracting so an old one is never extracted by mistake.

---

## 5. Deploying an update

**dev**
```bash
git switch dev && git pull
npm test                  # with npm run dev running
npm run package:dev       # → linqsafe-dev.zip
```
cPanel → File Manager → `linqsafe-dev` → **delete the old zip first** → Upload → Extract (overwrite: **yes**) → check the new `package.json` size/date changed → delete the zip → *Setup Node.js App* → **Run NPM Install** *(only if `package.json` changed)* → **Restart** → open `dev.linqsafe.com/api/health`.

**prod** (after checking on dev)
```bash
git switch prod && git pull && git merge dev && git push
npm run package           # → linqsafe-prod.zip
git switch dev
```
Upload `linqsafe-prod.zip` into `linqsafe` and `linqsafe-admin.zip` into `linqsafe-admin` (`npm run package:admin`), then **Restart** both apps.

Your `.env` is never in the zip, so extracting over the folder keeps your settings. Database changes apply automatically on restart (see `server/migrations.js`): you'll see `Applying migration …` in `stderr.log`.

**Before a prod deploy:** take a database backup (section 7) if the update includes a new migration.

---

## 6. Going live with payments and email

### Paystack
1. Paystack dashboard → complete business verification so live mode is enabled.
2. **Settings → API Keys & Webhooks**:
   - *Test mode* webhook: `https://dev.linqsafe.com/api/billing/webhook`
   - *Live mode* webhook: `https://linqsafe.com/api/billing/webhook`
3. Test keys go in dev's `.env`, live keys in prod's `.env`. Never mix a `pk_live` with an `sk_test`.
4. On dev, do one full test payment:
   - set a price in the founder console → *Pricing*;
   - dashboard → *Features* → **Unlock**;
   - pay with test card `4084 0840 8408 4081`, any future expiry, CVV `408`, PIN `0000`, OTP `123456`;
   - check: the feature is ticked, the payment shows on the founder console with "Visa •••• 4081", and Paystack shows the webhook as delivered.
5. Then set live prices on prod.

### Email (Resend)
1. Sign up at resend.com → **Domains** → add `linqsafe.com`.
2. Add the DNS records Resend shows (TXT/MX/CNAME) in cPanel → **Zone Editor** (or Namecheap Advanced DNS).
3. When verified, create an API key and put it in the `.env` of dev and prod as `RESEND_API_KEY`, with `MAIL_FROM=linqsafe <support@linqsafe.com>`. Restart.

Without a key, emails (verify, reset password) are written to `stderr.log` instead of sent.

---

## 7. Backups and rollback

**Database backup:** cPanel → **phpMyAdmin** → select `linqqkto_linqsafe` → **Export** → *Quick*, *SQL* → **Go**. Also check that your plan's automatic backups (cPanel → *Backup* / *JetBackup*) are on.

**Restore a database:** phpMyAdmin → select the database → **Import** → choose the `.sql` file → **Go**.

**Roll back the code:** keep the previous `linqsafe-prod.zip` (or rebuild it from the commit before: `git switch prod && git reset --hard <previous-commit>`; don't push that), upload, extract, restart.

Code and database changes are additive (migrations only add columns or tables), so an older version of the code still runs against a newer database.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `503` / "Incomplete response received from application" | the app crashed on start | run **`check`** (section 4.8), or open `stderr.log` in the app folder |
| `stderr.log`: `Error: Not supported` at `app.cjs:4` (and `tryModuleLoad`) | the app is on Node.js 10 | pick Node.js 20+ → Save → Run NPM Install → Restart |
| `check`: `ER_DBACCESS_DENIED_ERROR` | the user isn't added to the database | MySQL Databases → Add User To Database → Add → **ALL PRIVILEGES** → Make Changes |
| `check` not in the Run JS script list | old files on the server | delete the old zip, upload the new one, extract, refresh the page |
| Run JS script: `concurrently: command not found` / `exit code 127` | ran a computer-only command (`dev`, `package`) | only run `check` (or `owner`) on the server |
| `Could not connect to MySQL … (ER_ACCESS_DENIED_ERROR)` | `DB_HOST` is the server IP instead of `localhost`, or wrong password | `DB_HOST=localhost`; if still failing, MySQL Databases → Change Password and copy it exactly into `.env` (avoid `#`, quotes, spaces) |
| `… (ECONNREFUSED / ETIMEDOUT)` | `DB_HOST` isn't `localhost` | on cPanel always use `DB_HOST=localhost` |
| `Refusing to start: set a strong JWT_SECRET` | missing or `change-me` | set a long random `JWT_SECRET` |
| `Cannot find module …`, or no `node_modules` in the folder | packages not installed (also reset by a Node.js version change) | *Setup Node.js App* → **Run NPM Install** → **Restart** |
| Site shows the old version | not restarted, or browser cache | **Restart** the app; hard refresh (Cmd/Ctrl+Shift+R) |
| Can't stay logged in | the site is on `http://` | finish AutoSSL (section 4.9) and use `https://` |
| Founder console says "Not found" | `ADMIN_HOST` is set | open it on the admin subdomain |
| Founder console says "Owner only" | owner email not verified | confirm the email, or `npm run owner` |
| "Payments are not set up yet" | no `PAYSTACK_SECRET_KEY` | add it to `.env`, restart |
| Features say "Coming soon" | no price set | founder console → *Pricing* |
| Feature not unlocked after paying | webhook not set | check the webhook URL for that mode in Paystack; the return page also unlocks it |
| Country shows "Unknown" | visitor's time zone unavailable | expected for some visitors; there's no host location header on cPanel |

---

## 9. Settings reference

| Setting | local | dev | prod | Notes |
|---|---|---|---|---|
| `NODE_ENV` | — | `production` | `production` | turns on secure cookies |
| `DB_HOST` `DB_PORT` | `localhost` `3306` | `localhost` `3306` | `localhost` `3306` | |
| `DB_USER` `DB_PASSWORD` `DB_NAME` | your local MySQL, `linqsafe_local` | dev user, `linqqkto_linqsafe_dev` | prod user, `linqqkto_linqsafe` | different per stage |
| `JWT_SECRET` | anything | random | random | different per stage |
| `APP_URL` | — | `https://dev.linqsafe.com` | `https://linqsafe.com` | links in emails |
| `VITE_APP_STAGE` | `local` | set by `package:dev` | set by `package` | build time only |
| `OWNER_EMAIL` | your email | your email | your email | founder access once verified |
| `ADMIN_HOST` | — | `admin-dev.linqsafe.com` | `admin.linqsafe.com` | locks the founder API to that subdomain |
| `PAYSTACK_SECRET_KEY` | `sk_test_` | `sk_test_` | `sk_live_` | |
| `PAYSTACK_PUBLIC_KEY` | `pk_test_` | `pk_test_` | `pk_live_` | |
| `RESEND_API_KEY` `MAIL_FROM` | — | optional | yes | |
| `PRICE_*` `DISCOUNT_*` | optional | optional | optional | founder console overrides |

The code also supports Vercel (`api/index.js`, `vercel.json`) and Docker (`Dockerfile`, `docker-compose.yml`), but Namecheap's MySQL only accepts connections from its own server, so linqsafe runs on cPanel next to its database.
