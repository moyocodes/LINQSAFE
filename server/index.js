// Local / container entry point. On Vercel, api/index.js imports the same app as a serverless function.
import app from './app.js'
import { pool } from './db.js'

const port = process.env.PORT || 3001
const server = app.listen(port, () => console.log(`Server running on http://localhost:${port}`))
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => pool.end().then(() => process.exit(0))))
