// Local setup helper: marks the owner's email as verified and gives the account Pro.
//   npm run owner            (uses OWNER_EMAIL, default moyosorejames@gmail.com)
// In production, verify through the emailed link instead; this is for local development.
import { pool } from '../db.js'

const email = (process.env.OWNER_EMAIL || 'moyosorejames@gmail.com').toLowerCase()
const [r] = await pool.query("UPDATE users SET email_verified = 1, plan = 'pro' WHERE email = ?", [email])
console.log(r.affectedRows ? `${email} is verified, on Pro, and can open /owner.` : `No account uses ${email} yet. Sign up with it first.`)
await pool.end()
