# linqsafe: security, loopholes and risks

What protects the site today, what was fixed in the review on 9 Oct 2026, and the risks still open, most important first. Keep this file current when something changes.

---

## 1. How the site is protected

**Accounts and sessions**
- Passwords are bcrypt-hashed (cost 10). Sessions are signed tokens in an httpOnly, SameSite=Lax cookie (Secure in production) that page scripts can't read. They last 7 days.
- The server always takes the user from the session token. The browser never receives internal user ids, and no route trusts an id sent by the browser.
- A password reset signs out every session (`token_version`). Verify and reset links are one-time, stored only as SHA-256 hashes, and expire (24 h / 1 h).
- "Forgot password" gives the same answer whether or not the email exists, so it can't be used to find accounts.
- Log-in is by **email** and password only (usernames are public, so they're not accepted).
- An expired session sends you to log in and back to the page you were on. Only same-site paths are accepted as the return address.
- Soft-deleted accounts (`deleted_at`) can't log in or keep a session.

**Founder console**
- Only the founder email (hardcoded as `OWNER_EMAIL` in `server/emails.js`), and only once it's verified. Someone signing up with that address first gets nothing.
- On prod the founder API only answers on admin.linqsafe.com (`ADMIN_HOST`).

**Public pages**
- A page is a 404 until its owner verifies their email (`page_live`). It stays live if they change email later.
- A social badge must match the link's real domain, so a phishing link can't wear an "Instagram" badge.
- Link titles, bios and testimonials are rendered as text (React escapes them), and email templates escape every value.
- Links must be `http(s)://`, so `javascript:` and similar links are refused. Link logos must be uploaded pictures, not outside image links.
- No cookies for visitors. Unique visitors come from a daily-rotating HMAC of IP + browser; the IP is never stored.
- After a username change the old name is held for its owner for 90 days and forwards to the new one, so nobody can take over shared links or printed QR codes.

**Payments**
- A feature unlocks only after the server verifies the payment with Paystack (return page) or through the HMAC-signed webhook, never from the redirect alone. Prices are fixed at checkout.

**Requests**
- Rate limits per IP: sign-up / log-in / verify / reset 30 per 15 minutes, link clicks 30 a minute, contact form 5 an hour, everything else 600 a minute. Cached images don't count, because Nigerian mobile networks share IPs.
- Request size limits: 20 KB in general, 100 KB for links (logos), 900 KB for the profile (photos).
- CSP: scripts and API calls only from the site (plus Paystack's API); Paystack's checkout runs in its own frame; images from the site, `data:`, `blob:` and `https:`; the site can only be framed by itself.

---

## 2. Loopholes fixed on 9 Oct 2026

| # | Loophole | What could happen | Fix |
|---|---|---|---|
| 1 | Link logos bigger than ~20 KB were refused | Logo uploads failed silently | Links API accepts up to 100 KB |
| 2 | Changing email reset "verified", and unverified pages are hidden | A live page went offline when its owner changed email | `page_live` is set on first verification and never cleared |
| 3 | The login page's return address accepted `/\evil.com` | A crafted login link could send people to another site after logging in | Paths starting `//` or `/\` are refused |
| 4 | An old username was free the moment it changed | Someone could take it and receive the traffic from shared links and printed QR codes | Old names held 90 days for their owner, and they forward to the new name |
| 5 | Site-wide limit 300/min per IP, counting images | Visitors behind a shared mobile IP could be blocked | 600/min, images and favicons excluded |
| 6 | Soft-deleted accounts could still log in | A removed account stays usable | Login and sessions check `deleted_at` |
| 7 | Link logos could be outside `https://` images | That site would see the IP of every visitor (against "no tracking") | Uploads only |
| 8 | Saving prices in the founder console blanked the page | Founder couldn't see the dashboard after saving | Server reply complete, and the page merges replies; a crash screen with Reload replaces any blank page |
| 9 | Public API returned internal user ids | Ids could be enumerated | Removed from `/api/u` and `/api/me` |

All are covered by the API tests (`tests/api.test.js`) or were checked in a browser.

---

## 3. Known risks (not fixed yet)

### High

1. **Scams and phishing using linqsafe pages.** Anyone can sign up, verify an email and publish links, and redirect mode sends visitors straight to any URL. A scam page on linqsafe.com hurts the domain's reputation (browsers and WhatsApp can start flagging it).
   *Done:* the founder console's **Fraud & risk** page flags suspicious links, brand / "official" names, throwaway emails, sign-up bursts, shared WhatsApp numbers, click spam and payment abuse.
   *Done:* a founder **Suspend** button on each flag and on All users (`users.suspended_at` + reason): the page, previews, pictures and sitemap 404, clicks stop counting, and the owner sees the reason on their dashboard. **Unsuspend** restores it.
   *Next:* a "Report this page" link on public pages, and optionally checking links against Google Safe Browsing when they're saved.
2. **No way for users to delete their account or download their data.** The Nigeria Data Protection Act 2023 (and the GDPR for EU visitors) give people the right to both.
   *Next:* "Delete my account" in Your account (soft delete, then hard delete after 30 days) and an "export my data" JSON download. Update the Privacy page.
3. **The founder account is the master key, protected only by a password and a Gmail inbox.** Whoever controls moyosorejames@gmail.com can reset the password and open the founder console, including giving free features.
   *Next:* turn on 2-step verification on the Gmail account now. Later, add a second factor (email code or authenticator app) for founder log-ins.
4. **Database backups.** Everything (including uploaded pictures) is in one MySQL database on one cPanel server.
   *Next:* make sure cPanel's automatic backups (JetBackup) are on, and **export the prod database before each deploy that has a new migration** (`docs/DEPLOY.md` §7). This release adds migrations 26–29.

### Medium

5. **React Router open-redirect advisory** (GHSA-wrjc-x8rr-h8h6, all v6). The one place we pass a user-supplied path (`?next=`) is now checked. The proper fix is upgrading to react-router v7.18+, a major version, so it needs its own test pass.
6. **Rate limits live in memory.** They reset when the app restarts, and each cPanel process keeps its own count. That's fine at today's scale, but a determined attacker gets more attempts than the numbers suggest.
   *Next:* a MySQL-backed store for `express-rate-limit`, or Cloudflare in front of the site (also free DDoS protection).
7. **Passwords can be 6 characters.** *Next:* minimum 8, and refuse the most common passwords.
8. **Profile pictures can still be outside `https://` image links** (paste a link). As with link logos, that host sees visitors' IPs. *Next:* uploads only, or fetch and store the picture on save.
9. **Database growth.** `events` gets one row per view and click forever, and pictures are stored inline as base64. *Next:* archive or summarise events older than 13 months, and move pictures to object storage (Cloudflare R2 / S3) when the database passes a few GB.
10. **Each link click runs 3–4 small queries** (allowance, features, insert). Fine now. *Next:* cache prices and allowances in memory for a minute if clicks get heavy.

### Low

11. **Username forwarding ends after 90 days.** After that, anyone can take an old name. The owner is told when they change it; printed QR codes with the old name should be replaced within 90 days.
12. **Brand name.** "LinkSafe" is a registered product of Civica (Australia). linqsafe only uses "linksafe" as a hidden search keyword; avoid using it in visible text or ads.
13. **Sessions last 7 days and there's no "log out other devices"** except a password reset. *Next:* a "Sign out everywhere" button (bump `token_version`).

---

## 4. Checklist for every change

- New route that reads or writes a user's data: use `auth` and `req.userId`, never an id from the body or URL. Founder routes: `auth, ownerOnly`.
- New public field: check it isn't private (email, ids, payment details) and that hidden/unverified pages stay hidden (`page_live`, `is_public`, `deleted_at`).
- New upload: cap its size on the server, and add a body-size rule for that route if it's above 20 KB.
- New table or column: a new numbered step in `server/migrations.js`; back up prod before deploying it.
- Run `npm test` (and `API_URL=… npm test` against a fresh server), then check the change in a browser on a phone size.
