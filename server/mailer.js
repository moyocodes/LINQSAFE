// Sends transactional email through Resend's HTTP API (https://resend.com).
// Without RESEND_API_KEY (local dev) the message is printed to the console instead, so links in it
// (verify, reset) can still be clicked from the terminal. Templates live in ./emails.js.
const FROM = () => process.env.MAIL_FROM || 'linqsafe <onboarding@resend.dev>'
// Where replies go. Customers replying to any email reach support.
const REPLY_TO = () => process.env.SUPPORT_EMAIL || 'support@linqsafe.com'

export async function sendMail({ to, subject, text, html, replyTo = REPLY_TO(), tag }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`\n--- email (not sent: no RESEND_API_KEY) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n-------------------------------------------\n`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM(), to, subject, text, html, reply_to: replyTo, ...(tag && { tags: [{ name: 'type', value: tag }] }) }),
  })
  if (!res.ok) throw new Error(`Email send failed (${res.status}): ${await res.text()}`)
}

// Fire-and-forget: an email problem must never break a sign-up, payment or form. Errors are logged.
export function send(to, message, { tag, replyTo } = {}) {
  if (!to) return Promise.resolve()
  return sendMail({ to, ...message, tag, ...(replyTo && { replyTo }) }).catch((e) => console.error(`email "${message.subject}" to ${to}:`, e.message))
}
