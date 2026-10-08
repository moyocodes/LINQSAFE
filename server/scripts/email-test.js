// Sends one test email to check Resend is set up on this stage.
//   npm run email:test -- you@example.com        (cPanel: Run JS script → email:test, parameter: your email)
// With no address it uses OWNER_EMAIL.
import '../env.js'
import { sendMail } from '../mailer.js'
import { welcome } from '../emails.js'

const to = process.argv[2] || process.env.OWNER_EMAIL
const stage = process.env.APP_URL || 'local'
if (!to) { console.error('Give an address: npm run email:test -- you@example.com'); process.exit(1) }
if (!process.env.RESEND_API_KEY) console.log('No RESEND_API_KEY here, so the email is printed below instead of sent:\n')
try {
  const msg = welcome({ name: 'there', username: 'yourname' })
  await sendMail({ to, ...msg, subject: `Test email from linqsafe (${stage})`, tag: 'test' })
  console.log(process.env.RESEND_API_KEY
    ? `OK   sent to ${to} from ${process.env.MAIL_FROM || 'the default sender'}. Check the inbox (and spam), or Resend → Emails.`
    : 'Add RESEND_API_KEY to this .env and restart to send for real.')
} catch (e) {
  console.log(`FAIL ${e.message}`)
  if (/domain is not verified|not verified/i.test(e.message)) console.log('     → Resend → Domains: finish verifying linqsafe.com (DNS records in cPanel → Zone Editor).')
  if (/API key is invalid|401/i.test(e.message)) console.log('     → RESEND_API_KEY is wrong. Create a new one in Resend → API Keys.')
  if (/only send testing emails|own email/i.test(e.message)) console.log('     → Using onboarding@resend.dev only reaches your own Resend address. Verify linqsafe.com and set MAIL_FROM=linqsafe <support@linqsafe.com>.')
  process.exitCode = 1
}
