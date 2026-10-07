// Sends transactional email through Resend's HTTP API (https://resend.com).
// Without RESEND_API_KEY (local dev) the message is printed to the console instead, so the
// verify/reset links can still be clicked from the terminal.
const { RESEND_API_KEY, MAIL_FROM = 'linqsafe <onboarding@resend.dev>' } = process.env

export async function sendMail({ to, subject, text, html }) {
  if (!RESEND_API_KEY) {
    console.log(`\n--- email (dev, not sent) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n-----------------------------\n`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to, subject, text, html }),
  })
  if (!res.ok) throw new Error(`Email send failed (${res.status}): ${await res.text()}`)
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

export function actionEmail({ heading, body, button, url }) {
  return {
    text: `${heading}\n\n${body}\n\n${button}: ${url}\n\nIf you didn't request this, you can ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0d1a12">
  <h2 style="margin:0 0 12px">${esc(heading)}</h2>
  <p style="line-height:1.5">${esc(body)}</p>
  <p><a href="${esc(url)}" style="display:inline-block;background:#0d1a12;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${esc(button)}</a></p>
  <p style="font-size:12px;color:#666">If you didn't request this, you can ignore this email.</p>
</div>`,
  }
}
