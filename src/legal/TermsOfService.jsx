import LegalDocumentShell from './LegalDocumentShell.jsx';

export default function TermsOfService({ onBack }) {
  return (
    <LegalDocumentShell
      title="Hot Take – Terms of Service"
      effectiveDate="March 22, 2026"
      onBack={onBack}
    >
      <section className="legal-section">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using Hot Take (“the Platform,” “we,” “us,” or “our”), you agree to be
          bound by these Terms of Service (“Terms”). If you do not agree, you must not use the
          Platform.
        </p>
      </section>

      <section className="legal-section">
        <h2>2. Eligibility (18+ ONLY)</h2>
        <p>You must:</p>
        <ul>
          <li>Be at least 18 years old</li>
          <li>Have the legal capacity to enter into a binding agreement</li>
          <li>Comply with all applicable laws</li>
        </ul>
        <p>
          By using Hot Take, you represent and warrant that you meet these requirements.
        </p>
        <p>We reserve the right to:</p>
        <ul>
          <li>Request age verification at any time</li>
          <li>Suspend or terminate accounts suspected of being underage</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>3. Description of Service</h2>
        <p>Hot Take is a debate-focused social platform that allows users to:</p>
        <ul>
          <li>Participate in live and recorded debates</li>
          <li>Upload, share, and view content</li>
          <li>Engage in matchmaking and public discussions</li>
          <li>Follow and interact with other users</li>
        </ul>
        <p>
          We may modify, suspend, or discontinue any part of the Platform at any time without
          notice.
        </p>
      </section>

      <section className="legal-section">
        <h2>4. User Accounts</h2>
        <p>You are responsible for:</p>
        <ul>
          <li>Maintaining the confidentiality of your account</li>
          <li>All activity under your account</li>
        </ul>
        <p>You agree not to:</p>
        <ul>
          <li>Share or transfer your account</li>
          <li>Create accounts for others</li>
          <li>Use false or misleading information</li>
        </ul>
        <p>We may terminate or suspend accounts at our sole discretion.</p>
      </section>

      <section className="legal-section">
        <h2>5. User Conduct</h2>
        <p>You agree NOT to:</p>
        <ul>
          <li>Violate any law or regulation</li>
          <li>Engage in harassment, threats, or abuse</li>
          <li>Promote violence, terrorism, or criminal activity</li>
          <li>Share private or confidential information without consent</li>
          <li>Impersonate any person or entity</li>
          <li>Attempt to hack, exploit, or disrupt the Platform</li>
        </ul>
        <p>
          Hot Take supports open discussion, but illegal conduct and direct harm are strictly
          prohibited.
        </p>
      </section>

      <section className="legal-section">
        <h2>6. User Content &amp; License</h2>
        <p>You retain ownership of your content.</p>
        <p>However, by submitting content, you grant Hot Take a:</p>
        <ul>
          <li>Worldwide</li>
          <li>Non-exclusive</li>
          <li>Royalty-free</li>
          <li>Sublicensable</li>
          <li>Transferable license</li>
        </ul>
        <p>to:</p>
        <ul>
          <li>Use</li>
          <li>Host</li>
          <li>Store</li>
          <li>Reproduce</li>
          <li>Modify</li>
          <li>Publish</li>
          <li>Distribute</li>
          <li>Display</li>
        </ul>
        <p>This includes:</p>
        <ul>
          <li>Live debates</li>
          <li>Recorded content</li>
          <li>Clips and posts</li>
        </ul>
        <p>This license continues even if your content is removed.</p>
      </section>

      <section className="legal-section">
        <h2>7. Recording, Streaming &amp; Public Use</h2>
        <p>By using Hot Take, you acknowledge and agree:</p>
        <ul>
          <li>All debates may be recorded, stored, and publicly distributed</li>
          <li>Content may be used for promotion, marketing, or platform growth</li>
          <li>You waive any claims related to recording or public use of your participation</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>8. AI Moderation &amp; Platform Control</h2>
        <p>Hot Take may use automated systems, including AI, to:</p>
        <ul>
          <li>Moderate content</li>
          <li>Structure debates</li>
          <li>Enforce rules</li>
        </ul>
        <p>You acknowledge:</p>
        <ul>
          <li>AI systems may not be perfect</li>
          <li>Decisions may be made automatically</li>
        </ul>
        <p>We reserve full discretion to:</p>
        <ul>
          <li>Remove content</li>
          <li>Limit visibility</li>
          <li>Suspend or ban users</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>9. Monetization &amp; Platform Rights</h2>
        <p>Hot Take reserves the right to:</p>
        <ul>
          <li>Display advertisements</li>
          <li>Monetize user content</li>
          <li>Offer paid features, subscriptions, or promotions</li>
        </ul>
        <p>You are not entitled to compensation unless explicitly agreed in writing.</p>
      </section>

      <section className="legal-section">
        <h2>10. Copyright &amp; DMCA Policy</h2>
        <p>
          If you believe your copyrighted work has been used improperly, you may submit a DMCA
          takedown request.
        </p>
        <p>We will:</p>
        <ul>
          <li>Remove infringing content where appropriate</li>
          <li>Terminate repeat offenders</li>
        </ul>
        <p>False claims may result in liability.</p>
      </section>

      <section className="legal-section">
        <h2>11. Third-Party Content</h2>
        <p>Hot Take is not responsible for:</p>
        <ul>
          <li>Content posted by users</li>
          <li>Opinions expressed during debates</li>
          <li>External links or third-party services</li>
        </ul>
        <p>You access such content at your own risk.</p>
      </section>

      <section className="legal-section">
        <h2>12. No Professional Advice</h2>
        <p>Content on Hot Take is for informational and entertainment purposes only.</p>
        <p>It does not constitute:</p>
        <ul>
          <li>Medical advice</li>
          <li>Legal advice</li>
          <li>Financial advice</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>13. Disclaimer of Warranties</h2>
        <p>The Platform is provided “as is” and “as available.”</p>
        <p>We make no guarantees regarding:</p>
        <ul>
          <li>Reliability</li>
          <li>Accuracy</li>
          <li>Availability</li>
          <li>Security</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>14. Limitation of Liability</h2>
        <p>To the fullest extent permitted by law:</p>
        <p>Hot Take shall not be liable for:</p>
        <ul>
          <li>Indirect, incidental, or consequential damages</li>
          <li>Loss of data, profits, or reputation</li>
          <li>User disputes or interactions</li>
        </ul>
        <p>Your use of the Platform is at your own risk.</p>
      </section>

      <section className="legal-section">
        <h2>15. Indemnification</h2>
        <p>You agree to defend and indemnify Hot Take against any claims arising from:</p>
        <ul>
          <li>Your use of the Platform</li>
          <li>Your content</li>
          <li>Your violation of these Terms</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>16. Arbitration &amp; Dispute Resolution (CRITICAL)</h2>
        <p>Any disputes arising from these Terms will be resolved through:</p>
        <p>
          <strong>Binding arbitration, not court</strong>
        </p>
        <p>You agree:</p>
        <ul>
          <li>To waive your right to a jury trial</li>
          <li>To waive participation in class action lawsuits</li>
        </ul>
        <p>Arbitration will be conducted in accordance with applicable arbitration rules.</p>
      </section>

      <section className="legal-section">
        <h2>17. Termination</h2>
        <p>We may suspend or terminate your access at any time, for any reason, without notice.</p>
      </section>

      <section className="legal-section">
        <h2>18. Changes to Terms</h2>
        <p>We may update these Terms at any time.</p>
        <p>Continued use of Hot Take = acceptance of updated Terms.</p>
      </section>

      <section className="legal-section">
        <h2>19. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the jurisdiction in which Hot Take operates.
        </p>
      </section>
    </LegalDocumentShell>
  );
}
