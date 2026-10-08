// Which deployment this is (local / dev / prod) and whether we're on the founder subdomain.
// APP_STAGE is set per environment (.env.local locally; set at build time by npm run package / GitHub Actions for dev and prod).
export const STAGE =
  import.meta.env.APP_STAGE || (import.meta.env.DEV ? "local" : "prod");

// admin.linqsafe.com, admin-dev.linqsafe.com, admin.localhost — or an exact host from ADMIN_HOST.
const host = typeof window !== "undefined" ? window.location.hostname : "";
const configured = (import.meta.env.ADMIN_HOST || "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);
export const IS_ADMIN_HOST = configured.length
  ? configured.includes(host)
  : /^admin(-[a-z]+)?\./.test(host);
