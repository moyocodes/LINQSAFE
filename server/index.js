// Entry point: starts the Express app from ./app.js (locally, on cPanel via app.cjs, or in Docker).
import app from './app.js'
import { pool } from './db.js'

const port = process.env.PORT || 3001
const server = app.listen(port, () => console.log(`Server running on http://localhost:${port}`))
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => pool.end().then(() => process.exit(0))))
