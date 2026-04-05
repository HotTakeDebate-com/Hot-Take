import LegalDocumentShell from './LegalDocumentShell.jsx';
import { contactEmailLabel, contactEmailMailto } from './contactEmail.js';

function ContactEmail() {
  const href = contactEmailMailto();
  const label = contactEmailLabel();
  if (href) {
    return (
      <a href={href} className="legal-contact-link">
        {label}
      </a>
    );
  }
  return <span className="legal-contact-placeholder">{label}</span>;
}

export default function PrivacyPolicy({ onBack }) {
  return (
    <LegalDocumentShell
      title="Hot Take – Privacy Policy"
      effectiveDate="March 22, 2026"
      onBack={onBack}
    >
      <section className="legal-section">
        <h2>1. Introduction</h2>
        <p>
          Hot Take (“we,” “us,” or “our”) respects your privacy and is committed to protecting your
          personal information.
        </p>
        <p>
          This Privacy Policy explains how we collect, use, disclose, and safeguard your information
          when you use the Hot Take platform (“Platform”).
        </p>
        <p>By using Hot Take, you consent to the practices described in this Policy.</p>
      </section>

      <section className="legal-section">
        <h2>2. Information We Collect</h2>

        <h3 className="legal-subhead">A. Information You Provide</h3>
        <p>We may collect:</p>
        <ul>
          <li>Name or username</li>
          <li>Email address</li>
          <li>Account credentials</li>
          <li>Profile information</li>
          <li>Content you upload (debates, posts, recordings, messages)</li>
          <li>Communications with us</li>
        </ul>

        <h3 className="legal-subhead">B. Automatically Collected Information</h3>
        <p>We may automatically collect:</p>
        <ul>
          <li>IP address</li>
          <li>Device type and browser</li>
          <li>Operating system</li>
          <li>Usage data (clicks, interactions, time spent)</li>
          <li>Log data (timestamps, pages visited)</li>
        </ul>

        <h3 className="legal-subhead">C. Audio, Video &amp; Debate Content</h3>
        <p>Because Hot Take is a debate platform:</p>
        <ul>
          <li>We collect and store audio, video, and speech data</li>
          <li>This content may be recorded, processed, and analyzed</li>
        </ul>

        <h3 className="legal-subhead">D. AI-Generated &amp; Derived Data</h3>
        <p>We may generate or infer data such as:</p>
        <ul>
          <li>Content moderation signals</li>
          <li>Behavioral insights</li>
          <li>Engagement patterns</li>
        </ul>

        <h3 className="legal-subhead">E. Cookies &amp; Tracking Technologies</h3>
        <p>We use:</p>
        <ul>
          <li>Cookies</li>
          <li>Local storage</li>
          <li>Analytics tools</li>
        </ul>
        <p>These help us:</p>
        <ul>
          <li>Improve performance</li>
          <li>Personalize content</li>
          <li>Analyze usage</li>
        </ul>
        <p>
          You can disable cookies in your browser, but some features may not work.
        </p>
      </section>

      <section className="legal-section">
        <h2>3. How We Use Your Information</h2>
        <p>We use your data to:</p>
        <ul>
          <li>Operate and maintain the Platform</li>
          <li>Provide core features (debates, matchmaking, profiles)</li>
          <li>Moderate content (including AI-based moderation)</li>
          <li>Improve performance and user experience</li>
          <li>Communicate with you</li>
          <li>Prevent fraud, abuse, and illegal activity</li>
          <li>Develop new features</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>4. How We Share Your Information</h2>
        <p>We may share your information:</p>

        <h3 className="legal-subhead">A. Public Content</h3>
        <p>Content you post (debates, clips, posts) may be publicly visible</p>

        <h3 className="legal-subhead">B. Service Providers</h3>
        <p>We may share data with:</p>
        <ul>
          <li>Hosting providers</li>
          <li>Analytics providers</li>
          <li>Payment processors (if applicable)</li>
        </ul>

        <h3 className="legal-subhead">C. Legal Requirements</h3>
        <p>We may disclose information:</p>
        <ul>
          <li>To comply with laws or legal requests</li>
          <li>To enforce our Terms</li>
          <li>To protect rights, safety, and security</li>
        </ul>

        <h3 className="legal-subhead">D. Business Transfers</h3>
        <p>If Hot Take is involved in:</p>
        <ul>
          <li>A merger</li>
          <li>Acquisition</li>
          <li>Sale of assets</li>
        </ul>
        <p>Your data may be transferred.</p>
      </section>

      <section className="legal-section">
        <h2>5. Monetization &amp; Advertising</h2>
        <p>We may:</p>
        <ul>
          <li>Display ads</li>
          <li>Use analytics for targeted content</li>
          <li>Monetize platform activity</li>
        </ul>
        <p>We do not guarantee compensation for user data or content.</p>
      </section>

      <section className="legal-section">
        <h2>6. Data Retention</h2>
        <p>We retain your data:</p>
        <ul>
          <li>As long as necessary to operate the Platform</li>
          <li>To comply with legal obligations</li>
          <li>To enforce our rights</li>
        </ul>
        <p>
          We may retain certain data even after account deletion where legally permitted.
        </p>
      </section>

      <section className="legal-section">
        <h2>7. Your Rights (Important Section)</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Access your data</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion</li>
          <li>Restrict or object to processing</li>
          <li>Request a copy of your data</li>
        </ul>
        <p>
          To make a request, contact us at: <ContactEmail />
        </p>
      </section>

      <section className="legal-section">
        <h2>8. Data Security</h2>
        <p>We implement reasonable safeguards to protect your data.</p>
        <p>However:</p>
        <ul>
          <li>No system is 100% secure</li>
          <li>You use the Platform at your own risk</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>9. International Users</h2>
        <p>If you access Hot Take from outside your country:</p>
        <p>Your data may be transferred and processed in other jurisdictions</p>
      </section>

      <section className="legal-section">
        <h2>10. Children’s Privacy (18+ ONLY)</h2>
        <p>Hot Take is strictly 18+ only.</p>
        <p>We do not knowingly collect data from minors.</p>
        <p>If we discover such data, we will delete it.</p>
      </section>

      <section className="legal-section">
        <h2>11. Third-Party Links</h2>
        <p>We are not responsible for:</p>
        <ul>
          <li>Third-party websites</li>
          <li>External services linked on the Platform</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>12. Changes to This Policy</h2>
        <p>We may update this Privacy Policy at any time.</p>
        <p>Continued use of Hot Take means you accept the updated Policy.</p>
      </section>

      <section className="legal-section">
        <h2>13. Contact Information</h2>
        <p>For questions or requests, contact:</p>
        <p>
          Email: <ContactEmail />
        </p>
        <p>Company: Hot Take</p>
      </section>
    </LegalDocumentShell>
  );
}
