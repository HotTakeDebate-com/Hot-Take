import LegalDocumentShell from './LegalDocumentShell.jsx';

export default function CommunityGuidelines({ onBack, embedded = false }) {
  return (
    <LegalDocumentShell
      title="Hot Take – Community Guidelines"
      effectiveDate="March 22, 2026"
      onBack={onBack}
      embedded={embedded}
    >
      <section className="legal-section">
        <h2>1. Purpose of Hot Take</h2>
        <p>Hot Take is a platform for:</p>
        <ul>
          <li>Structured debate</li>
          <li>Open discussion</li>
          <li>Competitive exchange of ideas</li>
        </ul>
        <p>
          We support free expression, but not behavior that causes real harm, illegal activity, or
          platform abuse.
        </p>
      </section>

      <section className="legal-section">
        <h2>2. Core Principles</h2>

        <h3 className="legal-subhead">Debate the idea, not the person</h3>
        <ul>
          <li>Attack arguments, not individuals</li>
          <li>Personal insults weaken discussions and may be moderated</li>
        </ul>

        <h3 className="legal-subhead">Freedom with boundaries</h3>
        <p>You are allowed to express controversial or unpopular opinions</p>
        <p>You are NOT allowed to:</p>
        <ul>
          <li>Break the law</li>
          <li>Incite violence</li>
          <li>Harass or target individuals</li>
        </ul>

        <h3 className="legal-subhead">Structured discussion matters</h3>
        <p>Hot Take is not random shouting — it is:</p>
        <ul>
          <li>Turn-based debate</li>
          <li>Topic-focused</li>
          <li>Moderated (including AI systems)</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>3. Allowed Content</h2>
        <p>You may:</p>
        <ul>
          <li>Share opinions (even controversial ones)</li>
          <li>Debate politics, science, philosophy, culture, etc.</li>
          <li>Criticize ideas, institutions, and public figures</li>
          <li>Engage in competitive or intense discussion</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>4. Prohibited Content</h2>

        <h3 className="legal-subhead">Illegal Activity</h3>
        <ul>
          <li>Promoting or facilitating illegal acts</li>
          <li>Terrorism, exploitation, or criminal coordination</li>
        </ul>

        <h3 className="legal-subhead">Violence &amp; Harm</h3>
        <ul>
          <li>Direct threats</li>
          <li>Encouraging real-world harm</li>
          <li>Celebrating violence against individuals or groups</li>
        </ul>

        <h3 className="legal-subhead">Harassment &amp; Targeting</h3>
        <ul>
          <li>Repeated personal attacks</li>
          <li>Doxxing (sharing private info)</li>
          <li>Targeted harassment campaigns</li>
        </ul>

        <h3 className="legal-subhead">Exploitation &amp; Abuse</h3>
        <ul>
          <li>Non-consensual content</li>
          <li>Exploitation of individuals</li>
        </ul>

        <h3 className="legal-subhead">Platform Manipulation</h3>
        <ul>
          <li>Spamming</li>
          <li>Fake engagement</li>
          <li>Exploiting matchmaking or ranking systems</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>5. Sensitive Content (Handled Carefully)</h2>
        <p>The following may be allowed in a debate context, but can be moderated:</p>
        <ul>
          <li>Offensive or controversial viewpoints</li>
          <li>Heated arguments</li>
          <li>Strong language</li>
        </ul>
        <p>Moderation decisions may consider:</p>
        <ul>
          <li>Context</li>
          <li>Intent</li>
          <li>Debate format</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>6. AI Moderation &amp; Enforcement</h2>
        <p>Hot Take uses:</p>
        <ul>
          <li>AI systems</li>
          <li>Automated detection</li>
          <li>Human review (when applicable)</li>
        </ul>
        <p>These systems may:</p>
        <ul>
          <li>Remove content</li>
          <li>Limit visibility</li>
          <li>Issue warnings</li>
          <li>Suspend or ban accounts</li>
        </ul>
        <p>AI is not perfect, and enforcement decisions may occur automatically.</p>
      </section>

      <section className="legal-section">
        <h2>7. Debate Conduct Rules</h2>
        <p>During debates, users must:</p>
        <ul>
          <li>Stay on topic</li>
          <li>Avoid interrupting or spamming</li>
          <li>Respect turn structure</li>
          <li>Not attempt to break the format</li>
        </ul>
        <p>Failure to follow debate structure may result in:</p>
        <ul>
          <li>Muting</li>
          <li>Loss of speaking privileges</li>
          <li>Match termination</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>8. Reporting &amp; Enforcement</h2>
        <p>Users may report:</p>
        <ul>
          <li>Rule violations</li>
          <li>Harmful behavior</li>
          <li>Abuse or exploitation</li>
        </ul>
        <p>We may take action including:</p>
        <ul>
          <li>Content removal</li>
          <li>Account warnings</li>
          <li>Temporary suspension</li>
          <li>Permanent bans</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>9. Repeat Violations</h2>
        <p>Users who repeatedly violate rules may face:</p>
        <ul>
          <li>Permanent removal from the platform</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>10. No Guaranteed Visibility</h2>
        <p>Hot Take may:</p>
        <ul>
          <li>Limit reach</li>
          <li>Adjust visibility</li>
          <li>Remove content</li>
        </ul>
        <p>
          This does not mean your speech is removed — only that distribution may be controlled.
        </p>
      </section>

      <section className="legal-section">
        <h2>11. Respect the Platform</h2>
        <p>Do not:</p>
        <ul>
          <li>Attempt to reverse-engineer or exploit systems</li>
          <li>Abuse moderation systems</li>
          <li>Disrupt platform functionality</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>12. Changes to Guidelines</h2>
        <p>We may update these guidelines at any time.</p>
        <p>Continued use of Hot Take = acceptance of updates.</p>
      </section>
    </LegalDocumentShell>
  );
}
