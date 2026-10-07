import { Link } from 'react-router-dom'
import { Legal } from '@/components/Legal'
import { SITE } from '@/config'

export default function Privacy() {
  return (
    <Legal title="Privacy Policy">
      <p>This policy explains what information {SITE.name} collects, why, and the choices you have.</p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account information:</strong> your username and a hashed (never plain-text) password.</li>
        <li><strong>Profile content:</strong> display name, bio, and the links you add. This is public on your page.</li>
        <li><strong>Click counts:</strong> we count how many times each link is clicked. We do not store who clicked.</li>
        <li><strong>Contact messages:</strong> your name, email and message if you use the contact form.</li>
        <li><strong>Technical data:</strong> standard server logs such as IP address and browser type, used for security and abuse prevention.</li>
      </ul>

      <h2>How we use it</h2>
      <p>To run the Service, show your public page, provide your click statistics, respond to your messages, and protect against abuse. We do not sell your personal information.</p>

      <h2>Cookies and local storage</h2>
      <p>We store a sign-in token in your browser's local storage so you stay logged in. We do not use advertising cookies. Your hosting provider may set strictly necessary cookies.</p>

      <h2>Sharing</h2>
      <p>Your profile page and links are public. We share other data only with service providers that host or operate the Service on our behalf, or when required by law.</p>

      <h2>Retention and deletion</h2>
      <p>We keep your data while your account is active. To delete your account and its data, <Link to="/contact">contact us</Link> and we will remove it within a reasonable period.</p>

      <h2>Security</h2>
      <p>Passwords are hashed and connections should be encrypted with HTTPS. No system is perfectly secure, so please use a strong, unique password.</p>

      <h2>Your rights</h2>
      <p>Depending on where you live you may have the right to access, correct, export or delete your data. Contact us to make a request.</p>

      <h2>Children</h2>
      <p>The Service is not directed to children under 13 and we do not knowingly collect their data.</p>

      <h2>Changes and contact</h2>
      <p>We may update this policy and will change the date above when we do. Questions: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
    </Legal>
  )
}
