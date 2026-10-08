// Startup file for cPanel "Setup Node.js App" (Phusion Passenger / LiteSpeed).
// Passenger loads the startup file with require(), which can't load our ES-module server directly,
// so this CommonJS wrapper imports it. Passenger takes over app.listen(), so PORT doesn't matter there.
//
// If the packages aren't installed yet (fresh upload, or a Node.js version change), answer with a short
// page instead of crashing. cPanel's "Run NPM Install" first checks that the site responds, so a crash
// here would stop it from ever installing the packages.
try {
  require.resolve('express')
  require.resolve('mysql2')
} catch {
  require('http')
    .createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('linqsafe is installing. In cPanel: Setup Node.js App → Run NPM Install → Restart.')
    })
    .listen(process.env.PORT || 3001)
  return
}

import('./server/index.js').catch((err) => {
  console.error(err)
  process.exit(1)
})
