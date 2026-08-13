import LegalDocumentShell from './legal/LegalDocumentShell.jsx';
import { contactEmailLabel, contactEmailMailto } from './legal/contactEmail.js';

export default function SupportPage({ onBack }) {
  const mailto = contactEmailMailto();
  const label = contactEmailLabel();
  const hasEmail = Boolean(mailto);

  return (
    <LegalDocumentShell title="Support" onBack={onBack}>
      <section className="legal-section">
        <h3 className="legal-subhead">Contact us</h3>
        <p>
          For account help, privacy requests, technical issues, or general questions, email us at{' '}
          {hasEmail ? (
            <a href={mailto} className="legal-contact-link">
              {label}
            </a>
          ) : (
            <span className="legal-contact-placeholder">{label}</span>
          )}
          . We aim to reply within a few business days.
        </p>

        <h3 className="legal-subhead">Camera or microphone not working?</h3>
        <p>
          Allow camera and microphone in your browser (lock icon in the address bar). On Windows, also
          check Settings → Privacy → Camera / Microphone and allow your browser. If you have no camera,
          you can still join with audio only — you should still hear your opponent and see their video
          when they have a camera.
        </p>

        <h3 className="legal-subhead">Safety during a debate</h3>
        <p>
          If something goes wrong while you are matched with someone, use <strong>Report issue</strong>{' '}
          on the debate screen. Reports are reviewed by our team and help keep the community safer.
        </p>

        <h3 className="legal-subhead">Account &amp; privacy</h3>
        <p>
          For terms, privacy, and community rules, open <strong>Menu</strong> in the header. Privacy
          requests (access, deletion, etc.) can also be sent to the contact email above.
        </p>
      </section>
    </LegalDocumentShell>
  );
}
