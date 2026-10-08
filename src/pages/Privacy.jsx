import { Link } from 'react-router-dom'
import { Legal } from '@/components/Legal'
import { SITE } from '@/config'

export default function Privacy() {
  return (
    <Legal title="Privacy Policy">
      <p>This policy explains what information {SITE.name} collects, why, and the choices you have.</p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account information:</strong> your username, email address and a hashed (never plain-text) password. We also record when you last logged in.</li>
        <li><strong>Profile content:</strong> display name, bio, photos, topics, occupation, location, links, and for business accounts your category and optional WhatsApp number. This is public on your page.</li>
        <li><strong>Page analytics:</strong> when someone views your page or clicks a link we record the time, the referring website's domain, the device type (mobile, tablet, desktop) and the country. The country is worked out on our own server from the visitor's IP address using an offline database (no outside service sees it), or from the time zone set on their device. We do not store visitors' IP addresses, only the two-letter country. This site includes IP2Location LITE data available from <a className="underline" href="https://lite.ip2location.com" target="_blank" rel="noopener noreferrer">lite.ip2location.com</a>.</li>
        <li><strong>Payments:</strong> if you buy Pro, Paystack processes the payment. We receive the payment reference, amount and status, never your card or bank details.</li>
        <li><strong>Contact messages:</strong> your name, email and message if you use the contact form.</li>
        <li><strong>Technical data:</strong> standard server logs such as IP address and browser type, kept briefly for security and abuse prevention.</li>
      </ul>

      <h2>How we use it</h2>
      <p>To run the Service, show your public page, provide your analytics, send account emails (such as confirming your email or resetting your password), process payments, respond to your messages, and protect against abuse. We do not sell your personal information.</p>

      <h2>Cookies and local storage</h2>
      <ul>
        <li><strong>Sign-in (necessary):</strong> a secure, httpOnly cookie keeps you logged in.</li>
        <li><strong>Visitor count (optional):</strong> with your consent, an anonymous random ID cookie lets us count unique visitors and avoid counting a refresh twice. Decline in the cookie notice and pages still work; you just aren't counted as unique.</li>
        <li><strong>Preferences:</strong> your browser's local storage remembers your cookie choice and whether you're signed in.</li>
      </ul>
      <p>We do not use advertising or cross-site tracking cookies. Our host may also collect anonymous, cookie-free site traffic statistics.</p>

      <h2>Images on profiles</h2>
      <p>Photos you upload are stored with your profile. If you paste a link to an image hosted elsewhere, visitors' browsers load it from that site, which may see their IP address.</p>

      <h2>Sharing</h2>
      <p>Your profile page and links are public. We share other data only with service providers that operate the Service on our behalf (hosting, database, email delivery via Resend, payments via Paystack) or when required by law.</p>

      <h2>Retention and deletion</h2>
      <p>We keep your data while your account is active. To delete your account and its data, <Link to="/contact">contact us</Link> and we will remove it within a reasonable period.</p>

      <h2>Security</h2>
      <p>Passwords are hashed and connections should be encrypted with HTTPS. No system is perfectly secure, so please use a strong, unique password.</p>

      <h2>Your rights</h2>
      <p>Depending on where you live, including under Nigeria's Data Protection Act and the GDPR, you may have the right to access, correct, export or delete your data, and to object to processing. Contact us to make a request.</p>

      <h2>Children</h2>
      <p>The Service is not directed to children under 13 and we do not knowingly collect their data.</p>

      <h2>Changes and contact</h2>
      <p>We may update this policy and will change the date above when we do. Questions: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
    </Legal>
  )
}
