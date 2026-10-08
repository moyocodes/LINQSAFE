// Startup file for cPanel "Setup Node.js App" (Phusion Passenger).
// Passenger loads the startup file with require(), which can't load our ES-module server directly,
// so this CommonJS wrapper imports it. Passenger takes over app.listen(), so PORT doesn't matter there.
import('./server/index.js').catch((err) => {
  console.error(err)
  process.exit(1)
})
