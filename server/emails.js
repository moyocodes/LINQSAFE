// Branded email templates. Each returns { subject, html, text }.
// Email clients ignore most modern CSS, so the layout is table-based with inline styles, a 600px card,
// web-safe font stacks (Georgia stands in for Fraunces) and a plain-text version of every message.
// Preview them all: `npm run emails:preview` (writes HTML files to ./email-previews).

const APP = () => (process.env.APP_URL || 'https://linqsafe.com').replace(/\/$/, '')
const C = { paper: '#F6F3EE', card: '#FCFAF8', ink: '#261F1C', muted: '#6B625D', line: '#E7E1DA', cobalt: '#2B4FAF', saffron: '#D99A2B', soft: '#EEF1FA' }
const SERIF = "Georgia, 'Times New Roman', serif"
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const MONO = "'SFMono-Regular', Menlo, Consolas, monospace"

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
export const naira = (n) => `₦${Number(n).toLocaleString('en-NG')}`
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })

// ---- building blocks ------------------------------------------------------
const p = (html) => `<p style="margin:0 0 16px;font:16px/1.6 ${SANS};color:${C.ink}">${html}</p>`
const small = (html) => `<p style="margin:0 0 12px;font:13px/1.6 ${SANS};color:${C.muted}">${html}</p>`
const button = (label, url) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:6px;background:${C.cobalt}">
    <a href="${esc(url)}" style="display:inline-block;padding:14px 26px;font:600 15px ${SANS};color:#ffffff;text-decoration:none;border-radius:6px">${esc(label)} &rarr;</a>
  </td></tr></table>`
const linkFallback = (url) => small(`Button not working? Copy this link into your browser:<br><a href="${esc(url)}" style="color:${C.cobalt};word-break:break-all">${esc(url)}</a>`)
const steps = (items) => `
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px">${items.map((t, i) => `
    <tr><td valign="top" style="width:34px;padding:0 0 12px"><div style="width:24px;height:24px;border-radius:12px;background:${C.soft};color:${C.cobalt};font:700 12px/24px ${SANS};text-align:center">${i + 1}</div></td>
    <td style="padding:2px 0 12px;font:15px/1.5 ${SANS};color:${C.ink}">${t}</td></tr>`).join('')}
  </table>`
// Key/value box, for receipts and messages.
const box = (rows) => `
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;border:1px solid ${C.line};border-radius:8px;background:#ffffff">${rows.map(([k, v], i) => `
    <tr><td style="padding:12px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font:12px ${MONO};letter-spacing:.06em;text-transform:uppercase;color:${C.muted};width:38%">${esc(k)}</td>
    <td style="padding:12px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font:15px ${SANS};color:${C.ink};text-align:right">${v}</td></tr>`).join('')}
  </table>`
const quote = (text) => `<div style="margin:0 0 20px;padding:14px 16px;border-left:3px solid ${C.cobalt};background:#ffffff;font:15px/1.6 ${SANS};color:${C.ink};white-space:pre-wrap">${esc(text)}</div>`

// ---- the frame every email shares -------------------------------------------
// The person an email is about: their profile picture (or initial) and name, shown top right.
// avatar is a public https URL; uploaded pictures are served from /api/u/:username/avatar.
export function personOf(u) {
  if (!u) return null
  const app = APP()
  const avatar = u.avatar_url ? (String(u.avatar_url).startsWith('data:') ? `${app}/api/u/${u.username}/avatar` : u.avatar_url) : null
  return { name: u.display_name || u.username, username: u.username, avatar }
}
function personChip(person) {
  if (!person) return ''
  const pic = person.avatar
    ? `<img src="${esc(person.avatar)}" width="36" height="36" alt="" style="display:inline-block;vertical-align:middle;width:36px;height:36px;border-radius:18px;object-fit:cover;border:2px solid ${C.card}">`
    : `<span style="display:inline-block;vertical-align:middle;width:36px;height:36px;border-radius:18px;background:${C.cobalt};color:#fff;font:600 16px/36px ${SERIF};text-align:center">${esc((person.name || '?')[0].toUpperCase())}</span>`
  return `<td align="right" style="padding:0 8px 20px;white-space:nowrap"><span style="vertical-align:middle;margin-right:10px;font:600 13px ${SANS};color:${C.muted}">@${esc(person.username)}</span>${pic}</td>`
}

function layout({ preheader, eyebrow, heading, body, footnote, person }) {
  const app = APP()
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:${C.paper}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.paper}">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
    <tr><td style="padding:0 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="padding:0 8px 20px">
        <a href="${app}" style="text-decoration:none"><img src="${app}/icon-192.png" width="36" height="36" alt="linqsafe" style="vertical-align:middle;border:0;border-radius:9px">
        <span style="vertical-align:middle;margin-left:10px;font:700 20px ${SANS};color:${C.ink}">linqsafe<span style="color:#2B4FAF">.</span></span></a>
      </td>
      ${personChip(person)}
    </tr></table></td></tr>
    <tr><td style=""background:${C.card};border:1px solid ${C.line};border-radius:10px;padding:36px 32px">
      ${eyebrow ? `<p style="margin:0 0 10px;font:600 11px ${MONO};letter-spacing:.14em;text-transform:uppercase;color:${C.cobalt}">${esc(eyebrow)}</p>` : ''}
      <h1 style="margin:0 0 20px;font:600 30px/1.15 ${SERIF};color:${C.ink};letter-spacing:-.01em">${heading}</h1>
      ${body}
    </td></tr>
    <tr><td style="padding:22px 8px 0;font:12px/1.6 ${SANS};color:${C.muted}">
      ${footnote ? `${footnote}<br><br>` : ''}
      <a href="${app}" style="color:${C.muted}">linqsafe.com</a> &middot; One link for everything you share &middot; <a href="mailto:support@linqsafe.com" style="color:${C.muted}">support@linqsafe.com</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
}

// Plain-text twin: same words, no markup.
const textOf = (lines) => [...lines, '', '—', 'linqsafe · linqsafe.com · support@linqsafe.com'].join('\n')

// ---- the emails ----------------------------------------------------------------

export function verifyEmail({ username, url }) {
  return {
    subject: 'Confirm your email for linqsafe',
    html: layout({
      preheader: 'One tap to confirm, so you can always get back into your page.',
      eyebrow: 'Welcome',
      heading: `Welcome, @${esc(username)}`,
      body: p('Your page is ready. Confirm this is your email so you can reset your password if you ever forget it.') + button('Confirm my email', url) + linkFallback(url) + small('This link works for 24 hours.'),
      footnote: "Didn't sign up for linqsafe? You can ignore this email; nothing happens without confirming.",
    }),
    text: textOf([`Welcome, @${username}`, '', 'Your page is ready. Confirm this is your email so you can reset your password if you ever forget it.', '', `Confirm my email: ${url}`, '', 'This link works for 24 hours.', "Didn't sign up? Ignore this email."]),
  }
}

export function welcome({ name, username, person }) {
  const app = APP()
  const page = `${app}/${username}`
  return {
    subject: "You're all set. Here's how to make your page shine",
    html: layout({
      preheader: 'Your email is confirmed. Three quick things that make a page work.',
      person,
      eyebrow: 'Email confirmed',
      heading: `You're all set, ${esc(name)}`,
      body: p(`Your page lives at <a href="${page}" style="color:${C.cobalt};font-weight:600">${esc(page.replace(/^https?:\/\//, ''))}</a>. Three things that make it work:`)
        + steps([
          '<b>Add your socials and best links.</b> Paste a link and we add the right icon.',
          '<b>Add a photo and a one-line bio.</b> Pages with a picture get far more clicks.',
          '<b>Put the link in your bio</b> on Instagram, TikTok, X and WhatsApp.',
        ])
        + button('Open my dashboard', `${app}/admin`),
    }),
    text: textOf([`You're all set, ${name}`, '', `Your page: ${page}`, '', '1. Add your socials and best links.', '2. Add a photo and a one-line bio.', '3. Put the link in your bio on Instagram, TikTok, X and WhatsApp.', '', `Open my dashboard: ${app}/admin`]),
  }
}

export function resetPassword({ username, url }) {
  return {
    subject: 'Reset your linqsafe password',
    html: layout({
      preheader: 'Use this link within an hour to choose a new password.',
      eyebrow: 'Password reset',
      heading: 'Choose a new password',
      body: p(`Someone (hopefully you) asked to reset the password for <b>@${esc(username)}</b>.`) + button('Choose a new password', url) + linkFallback(url) + small('This link works for 1 hour and can be used once. Resetting signs you out on every other device.'),
      footnote: "Didn't ask for this? Ignore this email; your password won't change.",
    }),
    text: textOf(['Choose a new password', '', `Someone asked to reset the password for @${username}.`, '', `Choose a new password: ${url}`, '', 'This link works for 1 hour and can be used once.', "Didn't ask for this? Ignore this email."]),
  }
}

export function passwordChanged({ username, when = new Date(), person }) {
  const forgot = `${APP()}/forgot-password`
  return {
    subject: 'Your linqsafe password was changed',
    html: layout({
      preheader: 'If this was you, there is nothing to do.',
      person,
      eyebrow: 'Security',
      heading: 'Your password was changed',
      body: p(`The password for <b>@${esc(username)}</b> was changed on ${esc(fmtDate(when))}, and every other device was signed out.`)
        + p('<b>If this was you</b>, there is nothing to do.')
        + p(`<b>If it wasn't you</b>, reset your password straight away and reply to this email so we can help.`)
        + button('Reset my password', forgot),
    }),
    text: textOf(['Your password was changed', '', `The password for @${username} was changed on ${fmtDate(when)}.`, '', "If this wasn't you, reset it now and reply to this email:", forgot]),
  }
}

// items: [{ feature, months, until }]; one payment can unlock several features.
export function receipt({ name, items, amount, reference, method, date = new Date(), person }) {
  const app = APP()
  const names = items.map((i) => i.feature)
  const title = names.length === 1 ? `${names[0]} is unlocked` : `${names.length} features unlocked`
  const period = (m) => `${m} month${m > 1 ? 's' : ''}`
  const until = (u) => (u ? fmtDate(u) : 'No expiry')
  return {
    subject: `Receipt: ${names.length === 1 ? names[0] : `${names.length} features`} unlocked`,
    html: layout({
      preheader: `${names.join(', ')}: active now. Thank you!`,
      person,
      eyebrow: 'Payment received',
      heading: esc(title),
      body: p(`Thank you, ${esc(name)}! Your payment went through and ${names.length === 1 ? 'it is' : 'they are'} ready on your page.`)
        + box(items.map((i) => [i.feature, `${esc(period(i.months))} · until ${esc(until(i.until))}`]))
        + box([
          ['Amount', `<b>${esc(naira(amount))}</b>`],
          ['Paid with', esc(method || 'Paystack')],
          ['Date', esc(fmtDate(date))],
          ['Reference', `<span style="font-family:${MONO};font-size:13px">${esc(reference)}</span>`],
        ])
        + button('Use them now', `${app}/admin`)
        + small('Keep this email as your receipt. Questions about a payment? Reply with the reference above.'),
    }),
    text: textOf([title, '', `Thank you, ${name}!`, '', ...items.map((i) => `${i.feature}: ${period(i.months)}, until ${until(i.until)}`), '', `Amount: ${naira(amount)}`, `Paid with: ${method || 'Paystack'}`, `Date: ${fmtDate(date)}`, `Reference: ${reference}`, '', `Open your dashboard: ${app}/admin`]),
  }
}

export function featureExpiring({ name, feature, until, person }) {
  const url = `${APP()}/admin`
  return {
    subject: `${feature} ends on ${fmtDate(until)}`,
    html: layout({
      preheader: 'Extend it now and the new time is added to what is left.',
      person,
      eyebrow: 'Heads up',
      heading: `${esc(feature)} ends soon`,
      body: p(`Hi ${esc(name)}, your <b>${esc(feature)}</b> is active until <b>${esc(fmtDate(until))}</b>. After that your page switches back to the free version of it.`)
        + p('Extend it now and the new months are added on top of the days you have left, so you lose nothing.')
        + button(`Extend ${feature}`, url),
    }),
    text: textOf([`${feature} ends soon`, '', `Hi ${name}, your ${feature} is active until ${fmtDate(until)}.`, 'Extend it now and the new months are added on top of what is left.', '', `Extend: ${url}`]),
  }
}

export function featureExpired({ name, feature, person }) {
  const url = `${APP()}/admin`
  return {
    subject: `${feature} has ended`,
    html: layout({
      preheader: 'Your page is still live; this feature is back to the free version.',
      person,
      eyebrow: 'Feature ended',
      heading: `${esc(feature)} has ended`,
      body: p(`Hi ${esc(name)}, your <b>${esc(feature)}</b> period is over. Don't worry: your page is still live, and everything you set up is saved. It simply uses the free version until you unlock it again.`)
        + button(`Unlock ${feature} again`, url),
    }),
    text: textOf([`${feature} has ended`, '', `Hi ${name}, your ${feature} period is over. Your page is still live and your settings are saved.`, '', `Unlock it again: ${url}`]),
  }
}

export function contactReceived({ name, message }) {
  return {
    subject: 'We got your message',
    html: layout({
      preheader: "Thanks for writing. We'll reply by email, usually within a day.",
      eyebrow: 'Message received',
      heading: `Thanks, ${esc(name)}`,
      body: p("We got your message and will reply to this email address, usually within one working day. Here's what you sent:") + quote(message),
      footnote: 'Need to add something? Just reply to this email.',
    }),
    text: textOf([`Thanks, ${name}`, '', "We got your message and will reply, usually within one working day. You wrote:", '', message]),
  }
}

export function contactNotify({ name, email, message }) {
  return {
    subject: `New message from ${name}`,
    html: layout({
      preheader: message.slice(0, 90),
      eyebrow: 'Contact form',
      heading: `New message from ${esc(name)}`,
      body: box([['From', esc(name)], ['Email', `<a href="mailto:${esc(email)}" style="color:${C.cobalt}">${esc(email)}</a>`]]) + quote(message) + small('Reply to this email to answer them directly.'),
    }),
    text: textOf([`New message from ${name} <${email}>`, '', message]),
  }
}

// To the founder: someone just signed up.
export function ownerSignup({ username, email, accountType, category, url }) {
  return {
    subject: `New sign-up: @${username}`,
    html: layout({
      preheader: `@${username} (${email}) just created a page.`,
      eyebrow: 'New sign-up',
      heading: `@${esc(username)} just joined`,
      body: box([['Username', `@${esc(username)}`], ['Email', `<a href="mailto:${esc(email)}" style="color:${C.cobalt}">${esc(email)}</a>`],
        ['Account', esc(accountType + (category ? ` · ${category}` : ''))], ['Page', `<a href="${esc(url)}" style="color:${C.cobalt}">${esc(url)}</a>`]])
        + small('Sent to the founder for every new account.'),
    }),
    text: textOf([`New sign-up: @${username}`, `Email: ${email}`, `Account: ${accountType}${category ? ` · ${category}` : ''}`, `Page: ${url}`]),
  }
}

// Sample data for previews.
export const SAMPLES = {
  verifyEmail: [verifyEmail, { username: 'moyosore_james', url: 'https://linqsafe.com/verify?token=example' }],
  welcome: [welcome, { name: 'Moyosore', username: 'moyosore_james', person: { name: 'Moyosore', username: 'moyosore_james', avatar: null } }],
  resetPassword: [resetPassword, { username: 'moyosore_james', url: 'https://linqsafe.com/reset-password?token=example' }],
  passwordChanged: [passwordChanged, { username: 'moyosore_james' }],
  receipt: [receipt, { person: { name: 'Moyosore', username: 'moyosore_james', avatar: null }, name: 'Moyosore', amount: 8400, reference: 'LQS-MUYV7SAK-306953', method: 'Visa •••• 4081 · Zenith Bank', items: [{ feature: 'Unlimited links', months: 3, until: new Date(Date.now() + 90 * 864e5) }, { feature: 'Cover template', months: 3, until: new Date(Date.now() + 90 * 864e5) }] }],
  featureExpiring: [featureExpiring, { name: 'Moyosore', feature: 'Cover template', until: new Date(Date.now() + 3 * 864e5) }],
  featureExpired: [featureExpired, { name: 'Moyosore', feature: 'Cover template' }],
  contactReceived: [contactReceived, { name: 'Ada', message: 'Hi! Can I use my own domain for my page?\n\nThanks.' }],
  ownerSignup: [ownerSignup, { username: 'ada_bakes', email: 'ada@example.com', accountType: 'business', category: 'food', url: 'https://linqsafe.com/ada_bakes' }],
  contactNotify: [contactNotify, { name: 'Ada', email: 'ada@example.com', message: 'Hi! Can I use my own domain for my page?\n\nThanks.' }],
}
