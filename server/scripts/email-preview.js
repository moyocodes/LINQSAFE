// Writes every email template, filled with sample data, to ./email-previews/*.html to view in a browser.
//   npm run emails:preview
import fs from 'node:fs'
import { SAMPLES } from '../emails.js'

fs.mkdirSync('email-previews', { recursive: true })
const index = []
for (const [name, [make, data]] of Object.entries(SAMPLES)) {
  const { subject, html } = make(data)
  fs.writeFileSync(`email-previews/${name}.html`, html)
  index.push(`<li><a href="${name}.html">${name}</a> — ${subject}</li>`)
}
fs.writeFileSync('email-previews/index.html', `<!doctype html><meta charset="utf-8"><title>linqsafe emails</title><h1>linqsafe emails</h1><ul>${index.join('')}</ul>`)
console.log(`Wrote ${index.length} emails to email-previews/ (open email-previews/index.html)`)
