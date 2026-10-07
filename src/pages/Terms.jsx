import { Link } from 'react-router-dom'
import { Legal } from '@/components/Legal'
import { SITE } from '@/config'

export default function Terms() {
  return (
    <Legal title="Terms of Service">
      <p>These Terms govern your use of {SITE.name} (the "Service"). By creating an account or using the Service you agree to them. If you do not agree, do not use the Service.</p>

      <h2>1. Your account</h2>
      <p>You must provide accurate information and keep your password secure. You are responsible for all activity under your account. You must be old enough to form a binding contract where you live, and at least 13 years old.</p>

      <h2>2. Your content</h2>
      <p>You keep ownership of the links, names and text you add. You grant us a limited licence to host and display that content so the Service can work. You are responsible for what you publish and for having the right to publish it.</p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>link to malware, phishing, scams or other deceptive content;</li>
        <li>publish illegal content, or content that infringes others' rights;</li>
        <li>harass, threaten or exploit others, or share sexual content involving minors;</li>
        <li>impersonate another person or organisation;</li>
        <li>attack, overload, or attempt to gain unauthorised access to the Service.</li>
      </ul>

      <h2>4. Usernames</h2>
      <p>Usernames are first-come, first-served. We may reclaim or change usernames that impersonate others, infringe trademarks, or are inactive.</p>

      <h2>5. Termination</h2>
      <p>You may delete your links and stop using the Service at any time. We may suspend or remove accounts or content that violate these Terms or put the Service or others at risk.</p>

      <h2>6. Disclaimers</h2>
      <p>The Service is provided "as is" and "as available" without warranties of any kind. We do not guarantee uninterrupted or error-free operation, and we are not responsible for third-party sites you link to.</p>

      <h2>7. Limitation of liability</h2>
      <p>To the maximum extent permitted by law, {SITE.company} will not be liable for indirect, incidental or consequential damages, or for loss of data, profits or revenue arising from your use of the Service.</p>

      <h2>8. Changes</h2>
      <p>We may update these Terms. If changes are material we will take reasonable steps to let you know. Continuing to use the Service after changes means you accept them.</p>

      <h2>9. Contact</h2>
      <p>Questions about these Terms? Use our <Link to="/contact">contact form</Link> or email <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
    </Legal>
  )
}
