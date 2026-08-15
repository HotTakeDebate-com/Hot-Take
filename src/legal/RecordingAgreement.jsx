import { useEffect, useState } from 'react';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import AuthScreen from '../AuthScreen.jsx';
import { auth, isFirebaseConfigured } from '../firebase.js';
import { SiteFooter, SiteHeader } from '../SiteChrome.jsx';
import { contactEmailLabel, contactEmailMailto } from './contactEmail.js';
import './CommunityGuidelines.css';

function ContactEmail() {
  const href = contactEmailMailto();
  const label = contactEmailLabel();
  if (href) return <a href={href}>{label}</a>;
  return <span className="legal-contact-placeholder">{label}</span>;
}

function RecordingIcon({ type }) {
  const paths = {
    record: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></>,
    camera: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
    eyeOff: <><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11 11 0 0 1 12 5c5 0 8.5 3.5 10 7-0.5 1.4-1.3 2.7-2.3 3.7M6.2 6.2C4.7 7.2 3.5 8.7 3 12c.6 1.8 1.8 3.4 3.3 4.6" /></>,
    document: <><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></>,
    shield: <><path d="M12 3 5 6v6c0 4.5 2.8 7.8 7 9 4.2-1.2 7-4.5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></>,
    people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 21c0-5 2.5-8 6-8s6 3 6 8M15 14c4 0 6 2.5 6 7" /></>,
    alert: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5M12 17h.01" /></>,
    scale: <><path d="M12 3v18M7 21h10M4 7h16M4 7l-3 6h6L4 7Zm16 0-3 6h6l-3-6Z" /></>,
    repeat: <><path d="M4 7h13l-3-3M20 17H7l3 3M17 7a7 7 0 0 1 3 5M7 17a7 7 0 0 1-3-5" /></>,
    headset: <><path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15h4v6H6a2 2 0 0 1-2-2v-4ZM20 15h-4v6h2a2 2 0 0 0 2-2v-4Z" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 5 5" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
}

const cards = [
  { n: 1, icon: 'record', title: 'Overview', body: <><p>This Recording &amp; Streaming Consent Agreement (“Agreement”) governs your participation in audio, video, or text-based interactions on Hot Take that may be recorded, stored, or distributed.</p><p>By participating in a debate, discussion, or content session, you agree to this Agreement.</p></> },
  { n: 2, icon: 'camera', title: 'Acknowledgment of Recording', body: <><p>You acknowledge that debates, conversations, and interactions may be recorded. A recording may include:</p><ul><li>Audio</li><li>Video</li><li>Text</li><li>Screen activity</li></ul><p>Recording may occur automatically without additional notice.</p></> },
  { n: 3, icon: 'share', title: 'Consent to Use & Distribution', body: <><p>You grant Hot Take a worldwide, irrevocable, royalty-free, sublicensable, and transferable license to:</p><ul><li>Record your participation</li><li>Store and archive content</li><li>Edit, clip, and modify recordings</li><li>Publish and distribute recordings</li></ul><p>Content may be used for platform features, promotion, social distribution, and product development.</p></> },
  { n: 4, icon: 'globe', title: 'Public Nature of Participation', body: <><p>You understand that:</p><ul><li>Content may be publicly visible</li><li>Content may be viewed on or off the platform</li><li>Third parties may share content beyond Hot Take’s control</li></ul><p>You participate at your own discretion.</p></> },
  { n: 5, icon: 'eyeOff', title: 'No Expectation of Privacy', body: <><p>You acknowledge that:</p><ul><li>You have no expectation of privacy in a recorded session</li><li>Communications may be stored and reviewed</li></ul></> },
  { n: 6, icon: 'document', title: 'Waiver of Rights', body: <><p>To the fullest extent permitted by law, you waive:</p><ul><li>Any right to inspect or approve recordings</li><li>Any right to compensation</li><li>Claims related to recording, distribution, or public use</li></ul></> },
  { n: 7, icon: 'shield', title: 'User Responsibility', body: <><p>You agree:</p><ul><li>Not to share confidential or sensitive information</li><li>Not to include third parties without their consent</li><li>To comply with all applicable laws</li></ul><p>You are solely responsible for your participation.</p></> },
  { n: 8, icon: 'people', title: 'Third-Party Rights', body: <><p>If your content includes another person:</p><ul><li>You represent that you obtained their consent</li><li>You assume full responsibility for any violations</li></ul></> },
  { n: 9, icon: 'alert', title: 'Enforcement', body: <><p>Hot Take may:</p><ul><li>Remove or restrict content</li><li>Suspend or terminate access</li><li>Take action for violations of this Agreement</li></ul></> },
  { n: 10, icon: 'scale', title: 'Relationship to Terms', body: <><p>This Agreement is incorporated into and supplements the Hot Take Terms of Service.</p><p>If terms conflict, this Agreement controls matters involving recording and content usage.</p></> },
  { n: 11, icon: 'repeat', title: 'Changes to Agreement', body: <><p>We may update this Agreement at any time.</p><p>Continued use of Hot Take constitutes acceptance of updates.</p></> },
  { n: 12, icon: 'headset', title: 'Contact', body: <><p>For questions about recording, streaming, or this Agreement:</p><p>Email: <ContactEmail /></p><p>Company: Hot Take</p></> },
];

export default function RecordingAgreement({ onBack, embedded = false }) {
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
        <h1 className="legal-doc-title legal-doc-title--embedded">Hot Take – Recording &amp; Streaming Consent Agreement</h1>
        <p className="legal-doc-meta">Effective date: March 22, 2026</p>
      </header>
      {cards.map((card) => <section className="legal-section" key={card.n}>
        <h2>{card.n}. {card.title}</h2>
        {card.body}
      </section>)}
    </article>;
  }

  return <div className="community-guidelines-page">
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
        <p className="community-eyebrow">RECORDING &amp; CONSENT</p>
        <h1>Recording<br /><span>Agreement</span></h1>
        <p className="community-lead">Understand when debates may be recorded, how recordings may be used, and the choices and responsibilities that come with participating.</p>

        <div className="community-side-card">
          <div className="community-side-heading"><RecordingIcon type="record" /><strong>Clear Consent</strong></div>
          <p>Hot Take provides notice about recording so participants can make an informed choice before joining a debate.</p>
          <div className="community-divider" />
          <div className="community-date"><RecordingIcon type="calendar" /><span>Effective date<strong>March 22, 2026</strong></span></div>
        </div>

        <div className="community-side-card community-contact-card">
          <div className="community-side-heading"><RecordingIcon type="headset" /><strong>Questions?</strong></div>
          <p>If you have questions about recording or this agreement, contact us at:</p>
          <ContactEmail />
        </div>

        <div className="community-agreement"><RecordingIcon type="info" /><span>By participating in a recordable Hot Take session, you agree to this Recording Agreement.</span></div>
      </aside>

      <section className="community-grid" aria-label="Recording agreement">
        {cards.map((card) => <article className={`community-card community-card--${card.n}`} key={card.n}>
          <header>
            <RecordingIcon type={card.icon} />
            <h2><span>{card.n}.</span> {card.title}</h2>
            <button type="button" className="community-enlarge-button" onClick={() => setEnlargedCard(card)} aria-label={`Enlarge section ${card.n}: ${card.title}`} title="Enlarge this section">
              <RecordingIcon type="search" />
            </button>
          </header>
          <div className="community-card-body">{card.body}</div>
        </article>)}
        <p className="community-note"><RecordingIcon type="info" /> This agreement applies to Hot Take sessions that are designated as recordable. Review it before participating.</p>
      </section>
    </main>

    <SiteFooter onHome={onBack} onAbout={onBack} onFaq={onBack} onSupport={onBack} onPickLegal={() => {}} />
    {authModal && <AuthScreen variant="modal" initialMode={authModal} onClose={() => setAuthModal(null)} />}

    {enlargedCard && <div className="community-enlarge-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEnlargedCard(null); }}>
      <section className="community-enlarge-dialog" role="dialog" aria-modal="true" aria-labelledby={`recording-dialog-title-${enlargedCard.n}`}>
        <header className="community-enlarge-dialog-header">
          <div className="community-enlarge-dialog-title">
            <RecordingIcon type={enlargedCard.icon} />
            <h2 id={`recording-dialog-title-${enlargedCard.n}`}><span>{enlargedCard.n}.</span> {enlargedCard.title}</h2>
          </div>
          <button type="button" className="community-enlarge-close" onClick={() => setEnlargedCard(null)} aria-label="Close enlarged section" title="Close">
            <RecordingIcon type="close" />
          </button>
        </header>
        <div className="community-enlarge-dialog-body">{enlargedCard.body}</div>
        <p className="community-enlarge-hint">Press Esc or select × to close.</p>
      </section>
    </div>}
  </div>;
}
