# Vercel + cPanel Hosting Setup

This project is designed to run with Vercel for the frontend and API, while using a MySQL database hosted on cPanel.

## 1) Vercel deployment

Use Vercel for the app deployment and configure the project environment variables.

Example environment variables:

```env
DB_HOST=your-cpanel-db-host
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
DB_SSL=false
JWT_SECRET=your_very_long_random_secret
APP_URL=https://your-app.vercel.app
NODE_ENV=production
```

The app already includes Vercel routing in `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/((?!api/|assets/).*)", "destination": "/index.html" }
  ]
}
```

This means Vercel handles the frontend SPA routing and sends `/api/*` requests to the Express server.

## 2) cPanel MySQL configuration

If your database is on cPanel, you must allow remote MySQL access from the Vercel server.

Typical steps:

1. Create a MySQL database and user in cPanel.
2. Add the user to the database.
3. Enable or configure remote database access.
4. Use the database host, username, password, and database name in Vercel environment variables.

Important:

- Many shared cPanel plans block external MySQL connections by default.
- If remote MySQL is not enabled, Vercel will not be able to reach the database.
- If this is blocked, use a managed database provider such as PlanetScale, Railway, or Render, or deploy the API on a host that can reach the database.

## 3) Apache `.htaccess` note

`.htaccess` is for Apache-based hosting. It is not used by Vercel.

If you host on Apache/cPanel instead of Vercel, a simple route config is:

```apache
RewriteEngine On

# SPA route fallback
RewriteCond %{REQUEST_URI} !^/api/
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

## 4) What to remember

- Vercel = frontend host
- cPanel MySQL = database host only if remote access is allowed
- MySQL host must be reachable from the deployed app
- If cPanel blocks external DB access, you must use a different database host

## 5) Recommended setup

The most reliable setup for this app is:

- Frontend + API on Vercel
- MySQL on a remote-friendly host or provider
- If using cPanel, confirm remote connections are enabled first
