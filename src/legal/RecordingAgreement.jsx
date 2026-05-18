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

export default function RecordingAgreement({ onBack, embedded = false }) {
  return (
    <LegalDocumentShell
      title="Hot Take – Recording & Streaming Consent Agreement"
      effectiveDate="March 22, 2026"
      onBack={onBack}
      embedded={embedded}
    >
      <section className="legal-section">
        <h2>1. Overview</h2>
        <p>
          This Recording &amp; Streaming Consent Agreement (“Agreement”) governs your participation
          in any audio, video, or text-based interactions on Hot Take that may be recorded, stored, or
          distributed.
        </p>
        <p>
          By accessing or participating in any debate, discussion, or content session on Hot Take,
          you agree to this Agreement.
        </p>
      </section>

      <section className="legal-section">
        <h2>2. Acknowledgment of Recording</h2>
        <p>You acknowledge and agree that:</p>
        <ul>
          <li>All debates, conversations, and interactions may be recorded</li>
        </ul>
        <p>Recording may include:</p>
        <ul>
          <li>Audio</li>
          <li>Video</li>
          <li>Text</li>
          <li>Screen activity</li>
        </ul>
        <p>Recording may occur automatically without additional notice</p>
      </section>

      <section className="legal-section">
        <h2>3. Consent to Use &amp; Distribution</h2>
        <p>
          You grant Hot Take a worldwide, irrevocable, royalty-free, sublicensable, and transferable
          license to:
        </p>
        <ul>
          <li>Record your participation</li>
          <li>Store and archive content</li>
          <li>Edit, clip, and modify recordings</li>
          <li>Publish and distribute recordings</li>
        </ul>
        <p>Use content for:</p>
        <ul>
          <li>Platform features</li>
          <li>Promotion and marketing</li>
          <li>Social media distribution</li>
          <li>Product development</li>
        </ul>
        <p>This applies to both live and recorded content.</p>
      </section>

      <section className="legal-section">
        <h2>4. Public Nature of Participation</h2>
        <p>You understand that:</p>
        <ul>
          <li>Content may be publicly visible</li>
          <li>Content may be viewed by anyone on or off the platform</li>
          <li>Content may be shared by third parties beyond Hot Take’s control</li>
        </ul>
        <p>You participate at your own discretion.</p>
      </section>

      <section className="legal-section">
        <h2>5. No Expectation of Privacy</h2>
        <p>You acknowledge that:</p>
        <ul>
          <li>You have no expectation of privacy in any recorded session</li>
          <li>Communications may be stored and reviewed</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>6. Waiver of Rights</h2>
        <p>To the fullest extent permitted by law, you waive:</p>
        <ul>
          <li>Any right to inspect or approve recordings</li>
          <li>Any right to compensation</li>
        </ul>
        <p>Any claims related to:</p>
        <ul>
          <li>Recording</li>
          <li>Distribution</li>
          <li>Public use</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>7. User Responsibility</h2>
        <p>You agree:</p>
        <ul>
          <li>Not to share confidential or sensitive information</li>
          <li>Not to include third parties without their consent</li>
          <li>To comply with all applicable laws</li>
        </ul>
        <p>You are solely responsible for your participation.</p>
      </section>

      <section className="legal-section">
        <h2>8. Third-Party Rights</h2>
        <p>If your content includes another person:</p>
        <ul>
          <li>You represent that you have obtained their consent</li>
          <li>You assume full responsibility for any violations</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>9. Enforcement</h2>
        <p>Hot Take reserves the right to:</p>
        <ul>
          <li>Remove or restrict content</li>
          <li>Suspend or terminate access</li>
          <li>Take action for violations of this Agreement</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>10. Relationship to Terms of Service</h2>
        <p>
          This Agreement is incorporated into and supplements the Hot Take Terms of Service.
        </p>
        <p>
          In the event of a conflict, this Agreement will control regarding recording and content
          usage.
        </p>
      </section>

      <section className="legal-section">
        <h2>11. Changes to Agreement</h2>
        <p>We may update this Agreement at any time.</p>
        <p>Continued use of Hot Take constitutes acceptance of any updates.</p>
      </section>

      <section className="legal-section">
        <h2>12. Contact</h2>
        <p>For questions regarding this Agreement:</p>
        <p>
          Email: <ContactEmail />
        </p>
        <p>Company: Hot Take</p>
      </section>
    </LegalDocumentShell>
  );
}
