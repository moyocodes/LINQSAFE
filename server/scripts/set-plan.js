// Manually switch a user's plan until payments are connected:  npm run set-plan -- <username> <free|pro>
import { pool } from '../db.js'

const [username, plan] = process.argv.slice(2)
if (!username || !['free', 'pro'].includes(plan)) {
  console.error('Usage: npm run set-plan -- <username> <free|pro>')
  process.exit(1)
}
const [r] = await pool.query('UPDATE users SET plan = ?, pro_until = NULL WHERE username = ?', [plan, username.toLowerCase()])
console.log(r.affectedRows ? `${username} is now on ${plan}.` : `No user called ${username}.`)
await pool.end()
