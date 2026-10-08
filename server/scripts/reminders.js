// Daily email job: "ends in 3 days" and "has ended" notices for paid features.
// Run once a day from cPanel → Cron Jobs (see docs/DEPLOY.md), or by hand: npm run reminders
// Each purchase gets at most one of each email; renewing resets them.
import { pool } from '../db.js'
import { sendMail } from '../mailer.js'
import * as Email from '../emails.js'
import { featureByKey } from '../features.js'

const [soon] = await pool.query(
  `SELECT f.user_id, f.feature, f.expires_at, u.email, u.username, u.display_name, u.avatar_url FROM user_features f JOIN users u ON u.id = f.user_id
   WHERE f.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 DAY) AND f.reminded_at IS NULL AND u.email IS NOT NULL`)
const [ended] = await pool.query(
  `SELECT f.user_id, f.feature, u.email, u.username, u.display_name, u.avatar_url FROM user_features f JOIN users u ON u.id = f.user_id
   WHERE f.expires_at BETWEEN DATE_SUB(NOW(), INTERVAL 3 DAY) AND NOW() AND f.expired_notice_at IS NULL AND u.email IS NOT NULL`)

let sent = 0
for (const r of soon) {
  try {
    await sendMail({ to: r.email, tag: 'expiring', ...Email.featureExpiring({ person: Email.personOf(r), name: r.display_name || r.username, feature: featureByKey[r.feature]?.name || r.feature, until: r.expires_at }) })
    await pool.query('UPDATE user_features SET reminded_at = NOW() WHERE user_id = ? AND feature = ?', [r.user_id, r.feature])
    sent++
  } catch (e) { console.error(`expiring ${r.username}/${r.feature}:`, e.message) }
}
for (const r of ended) {
  try {
    await sendMail({ to: r.email, tag: 'expired', ...Email.featureExpired({ person: Email.personOf(r), name: r.display_name || r.username, feature: featureByKey[r.feature]?.name || r.feature }) })
    await pool.query('UPDATE user_features SET expired_notice_at = NOW() WHERE user_id = ? AND feature = ?', [r.user_id, r.feature])
    sent++
  } catch (e) { console.error(`expired ${r.username}/${r.feature}:`, e.message) }
}
console.log(`reminders: ${soon.length} ending soon, ${ended.length} ended, ${sent} emails sent`)
await pool.end()
