import { useEffect, useState } from 'react';
import AuthScreen from '../AuthScreen.jsx';
import { auth, isFirebaseConfigured } from '../firebase.js';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import { SiteFooter, SiteHeader } from '../SiteChrome.jsx';
import './CommunityGuidelines.css';

function GuidelineIcon({ type }) {
  const paths = {
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 0v4M12 20v4M0 12h4M20 12h4" /></>,
    scale: <><path d="M12 3v18M7 21h10M4 7h16M4 7l-3 6h6L4 7Zm16 0-3 6h6l-3-6Z" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m7 12 3 3 7-7" /></>,
    x: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
    alert: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5M12 17h.01" /></>,
    robot: <><rect x="5" y="7" width="14" height="13" rx="3" /><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8M3 12h2M19 12h2" /></>,
    people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 21c0-5 2.5-8 6-8s6 3 6 8M15 14c4 0 6 2.5 6 7" /></>,
    flag: <><path d="M5 22V3M6 4h12l-3 4 3 4H6" /></>,
    repeat: <><path d="M4 7h13l-3-3M20 17H7l3 3M17 7a7 7 0 0 1 3 5M7 17a7 7 0 0 1-3-5" /></>,
    eyeOff: <><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11 11 0 0 1 12 5c5 0 8.5 3.5 10 7-0.5 1.4-1.3 2.7-2.3 3.7M6.2 6.2C4.7 7.2 3.5 8.7 3 12c.6 1.8 1.8 3.4 3.3 4.6" /></>,
    shield: <><path d="M12 3 5 6v6c0 4.5 2.8 7.8 7 9 4.2-1.2 7-4.5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></>,
    edit: <><path d="M4 20h4L19 9l-4-4L4 16v4ZM13 6l4 4" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    headset: <><path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15h4v6H6a2 2 0 0 1-2-2v-4ZM20 15h-4v6h2a2 2 0 0 0 2-2v-4Z" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 5 5" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
}

const cards = [
  { n: 1, icon: 'target', title: 'Purpose of Hot Take', body: <><p>Hot Take is a platform for:</p><ul><li>Structured debate</li><li>Open discussion</li><li>Competitive exchange of ideas</li></ul><p>We support free expression, but not behavior that causes real harm, illegal activity, or platform abuse.</p></> },
  { n: 2, icon: 'scale', title: 'Core Principles', body: <><h4>Debate the idea, not the person</h4><ul><li>Attack arguments, not individuals.</li><li>Personal insults weaken discussions and may be moderated.</li></ul><h4>Freedom with boundaries</h4><p>You are allowed to express controversial or unpopular opinions. You are NOT allowed to break the law, incite violence, or harass or target individuals.</p><h4>Structured discussion matters</h4><p>Hot Take is not random shouting — it is turn-based, topic-focused, and moderated (including AI systems).</p></> },
  { n: 3, icon: 'check', title: 'Allowed Content', body: <><p>You may:</p><ul><li>Share opinions (even controversial ones)</li><li>Debate politics, science, philosophy, culture, etc.</li><li>Criticize ideas, institutions, and public figures</li><li>Engage in competitive or intense discussion</li></ul></> },
  { n: 4, icon: 'x', title: 'Prohibited Content', body: <><h4>Illegal Activity</h4><ul><li>Promoting or facilitating illegal acts</li><li>Terrorism, exploitation, or criminal coordination</li></ul><h4>Violence &amp; Harm</h4><ul><li>Direct threats</li><li>Encouraging real-world harm</li><li>Celebrating violence against individuals or groups</li></ul><h4>Harassment &amp; Targeting</h4><ul><li>Repeated personal attacks</li><li>Doxxing (sharing private info)</li><li>Targeted harassment campaigns</li></ul><h4>Exploitation &amp; Abuse</h4><ul><li>Non-consensual content</li><li>Exploitation of individuals</li></ul><h4>Platform Manipulation</h4><ul><li>Spamming</li><li>Fake engagement</li><li>Exploiting matchmaking or ranking systems</li></ul></> },
  { n: 5, icon: 'alert', title: 'Sensitive Content', subtitle: '(Handled Carefully)', body: <><p>The following may be allowed in a debate context, but can be moderated:</p><ul><li>Offensive or controversial viewpoints</li><li>Heated arguments</li><li>Strong language</li></ul><p>Moderation decisions may consider:</p><ul><li>Context</li><li>Intent</li><li>Debate format</li></ul></> },
  { n: 6, icon: 'robot', title: 'AI Moderation & Enforcement', body: <><p>Hot Take uses AI systems, automated detection, and human review (when applicable).</p><p>These systems may:</p><ul><li>Remove content</li><li>Limit visibility</li><li>Issue warnings</li><li>Suspend or ban accounts</li></ul><p>AI is not perfect, and enforcement decisions may occur automatically.</p></> },
  { n: 7, icon: 'people', title: 'Debate Conduct Rules', body: <><p>During debates, users must:</p><ul><li>Stay on topic</li><li>Avoid interrupting or spamming</li><li>Respect turn structure</li><li>Not attempt to break the format</li></ul><p>Failure to follow debate structure may result in:</p><ul><li>Muting</li><li>Loss of speaking privileges</li><li>Match termination</li></ul></> },
  { n: 8, icon: 'flag', title: 'Reporting & Enforcement', body: <><p>Users may report:</p><ul><li>Rule violations</li><li>Harmful behavior</li><li>Abuse or exploitation</li></ul><p>We may take action including:</p><ul><li>Content removal</li><li>Account warnings</li><li>Temporary suspension</li><li>Permanent bans</li></ul></> },
  { n: 9, icon: 'repeat', title: 'Repeat Violations', body: <><p>Users who repeatedly violate rules may face:</p><ul><li>Permanent removal from the platform</li></ul></> },
  { n: 10, icon: 'eyeOff', title: 'No Guaranteed Visibility', body: <><p>Hot Take may:</p><ul><li>Limit reach</li><li>Adjust visibility</li><li>Remove content</li></ul><p>This does not mean your speech is removed — only that distribution may be controlled.</p></> },
  { n: 11, icon: 'shield', title: 'Respect the Platform', body: <><p>Do not:</p><ul><li>Attempt to reverse-engineer or exploit systems</li><li>Abuse moderation systems</li><li>Disrupt platform functionality</li></ul></> },
  { n: 12, icon: 'edit', title: 'Changes to Guidelines', body: <><p>We may update these guidelines at any time.</p><p>Continued use of Hot Take = acceptance of updates.</p></> },
];

export default function CommunityGuidelines({ onBack, embedded = false }) {
  const [isSignedIn, setIsSignedIn] = useState(Boolean(auth?.currentUser));
  const [authModal, setAuthModal] = useState(null);
  const [enlargedCard, setEnlargedCard] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return undefined;
    return onIdTokenChanged(auth, (user) => setIsSignedIn(Boolean(user)));
  }, []);

  useEffect(() => {
    if (!enlargedCard) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setEnlargedCard(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enlargedCard]);

  useEffect(() => {
    document.body.style.overflow = enlargedCard ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [enlargedCard]);

  const handleQuickMatch = () => {
    if (!isSignedIn) {
      setAuthModal('signin');
      return;
    }
    window.location.assign('/?quickMatch=1');
  };

  const handleSignOut = async () => {
    try { if (auth) await signOut(auth); } catch { /* ignore */ }
    onBack?.();
  };

  if (embedded) {
    return <article className="legal-doc-article legal-doc-article--embedded">
      <header className="legal-doc-header">
        <h1 className="legal-doc-title legal-doc-title--embedded">Hot Take – Community Guidelines</h1>
        <p className="legal-doc-meta">Effective date: March 22, 2026</p>
      </header>
      {cards.map((card) => <section className="legal-section" key={card.n}>
        <h2>{card.n}. {card.title}{card.subtitle ? ` ${card.subtitle}` : ''}</h2>
        {card.body}
      </section>)}
    </article>;
  }

  return <div className="community-guidelines-page legal-traditional-page">
    <SiteHeader
      onHome={onBack}
      onAbout={onBack}
      onTopics={onBack}
      onQuickMatch={handleQuickMatch}
      onFaq={onBack}
      onSupport={onBack}
      isSignedIn={isSignedIn}
      onSignIn={() => setAuthModal('signin')}
      onSignUp={() => setAuthModal('signup')}
      onSignOut={handleSignOut}
      onProfile={onBack}
      onPickLegal={() => {}}
    />

    <main className="community-guidelines-content">
      <aside className="community-intro">
        <p className="community-eyebrow">COMMUNITY</p>
        <h1>Community<br /><span>Guidelines</span></h1>
        <p className="community-lead">These guidelines ensure Hot Take remains a space for meaningful debate, respectful discussion, and the free exchange of ideas.</p>

        <div className="community-side-card">
          <div className="community-side-heading"><GuidelineIcon type="shield" /><strong>Our Commitment</strong></div>
          <p>We protect free expression while maintaining a safe, structured, and respectful environment for all users.</p>
          <div className="community-divider" />
          <div className="community-date"><GuidelineIcon type="calendar" /><span>Effective date<strong>March 22, 2026</strong></span></div>
        </div>

        <div className="community-side-card community-contact-card">
          <div className="community-side-heading"><GuidelineIcon type="headset" /><strong>Questions?</strong></div>
          <p>If you have any questions about these guidelines, contact us at:</p>
          <a href="mailto:support@hottakedebate.com">support@hottakedebate.com</a>
        </div>

        <div className="community-agreement"><GuidelineIcon type="info" /><span>By using Hot Take, you agree to abide by these Community Guidelines.</span></div>
      </aside>

      <section className="community-grid" aria-label="Community guidelines">
        {cards.map((card) => <article className={`community-card community-card--${card.n}`} key={card.n}>
          <header>
            <GuidelineIcon type={card.icon} />
            <h2><span>{card.n}.</span> {card.title} {card.subtitle && <em>{card.subtitle}</em>}</h2>
            <button
              type="button"
              className="community-enlarge-button"
              onClick={() => setEnlargedCard(card)}
              aria-label={`Enlarge guideline ${card.n}: ${card.title}`}
              title="Enlarge this guideline"
            >
              <GuidelineIcon type="search" />
            </button>
          </header>
          <div className="community-card-body">{card.body}</div>
        </article>)}
        <p className="community-note"><GuidelineIcon type="info" /> These guidelines apply to all users on Hot Take. We appreciate your help in keeping debates meaningful, competitive, and respectful.</p>
      </section>
    </main>

    <SiteFooter onHome={onBack} onAbout={onBack} onFaq={onBack} onSupport={onBack} onPickLegal={() => {}} />

    {authModal && <AuthScreen variant="modal" initialMode={authModal} onClose={() => setAuthModal(null)} />}

    {enlargedCard && <div
      className="community-enlarge-overlay"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) setEnlargedCard(null); }}
    >
      <section
        className="community-enlarge-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`guideline-dialog-title-${enlargedCard.n}`}
      >
        <header className="community-enlarge-dialog-header">
          <div className="community-enlarge-dialog-title">
            <GuidelineIcon type={enlargedCard.icon} />
            <h2 id={`guideline-dialog-title-${enlargedCard.n}`}><span>{enlargedCard.n}.</span> {enlargedCard.title} {enlargedCard.subtitle && <em>{enlargedCard.subtitle}</em>}</h2>
          </div>
          <button
            type="button"
            className="community-enlarge-close"
            onClick={() => setEnlargedCard(null)}
            aria-label="Close enlarged guideline"
            title="Close"
          >
            <GuidelineIcon type="close" />
          </button>
        </header>
        <div className="community-enlarge-dialog-body">{enlargedCard.body}</div>
        <p className="community-enlarge-hint">Press Esc or select × to close.</p>
      </section>
    </div>}
  </div>;
}
