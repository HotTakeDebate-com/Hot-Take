import { useEffect, useState } from 'react';
import AuthScreen from '../AuthScreen.jsx';
import { auth, isFirebaseConfigured } from '../firebase.js';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import { SiteFooter, SiteHeader } from '../SiteChrome.jsx';
import { contactEmailLabel, contactEmailMailto } from './contactEmail.js';
import './PrivacyPolicy.css';

function PrivacyIcon({ type }) {
  const paths = {
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4.3 3.5-6.5 8-6.5s7.2 2.2 8 6.5" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 0v4M12 20v4M0 12h4M20 12h4" /></>,
    people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 21c0-5 2.5-8 6-8s6 3 6 8M15 14c4 0 6 2.5 6 7" /></>,
    money: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M15 9.5c-.6-1-1.5-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 2 3 2 3 .8 3 2-1.3 2-3 2c-1.5 0-2.5-.5-3-1.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    rights: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5M12 16h.01" /></>,
    shield: <><path d="M12 3 5 6v6c0 4.5 2.8 7.8 7 9 4.2-1.2 7-4.5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-6.5-3.8-9S9.5 5.5 12 3Z" /></>,
    children: <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2" /><path d="M3 21c0-4.5 2.2-7 6-7s6 2.5 6 7M15 15c3.5 0 5.5 2 6 6" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" /></>,
    edit: <><path d="M4 20h4L19 9l-4-4L4 16v4ZM13 6l4 4" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 5 5" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    headset: <><path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15h4v6H6a2 2 0 0 1-2-2v-4ZM20 15h-4v6h2a2 2 0 0 1 2-2v-4Z" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
}

function ContactEmail() {
  const href = contactEmailMailto();
  const label = contactEmailLabel();
  return href ? <a href={href} className="legal-contact-link">{label}</a> : <span className="legal-contact-placeholder">{label}</span>;
}

const cards = [
  { n: 1, icon: 'user', title: 'Introduction', body: <><p>Hot Take (“we,” “us,” or “our”) respects your privacy and is committed to protecting your personal information.</p><p>This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Hot Take platform (“Platform”).</p><p>By using Hot Take, you consent to the practices described in this Policy.</p></> },
  { n: 2, icon: 'database', title: 'Information We Collect', body: <div className="privacy-collect-sections">
    <section><h4>A. Information You Provide</h4><p>We may collect:</p><ul><li>Name or username</li><li>Email address</li><li>Account credentials</li><li>Profile information</li><li>Content you upload (debates, posts, recordings, messages)</li><li>Communications with us</li></ul></section>
    <section><h4>B. Automatically Collected Information</h4><p>We may automatically collect:</p><ul><li>IP address</li><li>Device type and browser</li><li>Operating system</li><li>Usage data (clicks, interactions, time spent)</li><li>Log data (timestamps, pages visited)</li></ul></section>
    <section><h4>C. Audio, Video &amp; Debate Content</h4><p>Because Hot Take is a debate platform:</p><ul><li>We collect and store audio, video, and speech data</li><li>This content may be recorded, processed, and analyzed</li></ul></section>
    <section><h4>D. AI-Generated &amp; Derived Data</h4><p>We may generate or infer data such as:</p><ul><li>Content moderation signals</li><li>Behavioral insights</li><li>Engagement patterns</li></ul></section>
    <section className="privacy-collect-e"><h4>E. Cookies &amp; Tracking Technologies</h4><div className="privacy-collect-e-columns"><div><p>We use:</p><ul><li>Cookies</li><li>Local storage</li><li>Analytics tools</li></ul></div><div><p>These help us:</p><ul><li>Improve performance</li><li>Personalize content</li><li>Analyze usage</li></ul></div></div><p>You can disable cookies in your browser, but some features may not work.</p></section>
  </div> },
  { n: 3, icon: 'target', title: 'How We Use Your Information', body: <><p>We use your data to:</p><ul><li>Operate and maintain the Platform</li><li>Provide core features (debates, matchmaking, profiles)</li><li>Moderate content (including AI-based moderation)</li><li>Improve performance and user experience</li><li>Communicate with you</li><li>Prevent fraud, abuse, and illegal activity</li><li>Develop new features</li></ul></> },
  { n: 4, icon: 'people', title: 'How We Share Your Information', body: <><h4>A. Public Content</h4><p>Content you post (debates, clips, posts) may be publicly visible.</p><h4>B. Service Providers</h4><p>We may share data with hosting providers, analytics providers, and payment processors (if applicable).</p><h4>C. Legal Requirements</h4><p>We may disclose information to comply with laws or legal requests, enforce our Terms, and protect rights, safety, and security.</p><h4>D. Business Transfers</h4><p>If Hot Take is involved in a merger, acquisition, or sale of assets, your data may be transferred.</p></> },
  { n: 5, icon: 'money', title: 'Monetization & Advertising', body: <><p>We may:</p><ul><li>Display ads</li><li>Use analytics for targeted content</li><li>Monetize platform activity</li></ul><p>We do not guarantee compensation for user data or content.</p></> },
  { n: 6, icon: 'clock', title: 'Data Retention', body: <><p>We retain your data:</p><ul><li>As long as necessary to operate the Platform</li><li>To comply with legal obligations</li><li>To enforce our rights</li></ul><p>We may retain certain data even after account deletion where legally permitted.</p></> },
  { n: 7, icon: 'rights', title: 'Your Rights', subtitle: '(Important Section)', body: <><p>Depending on your location, you may have the right to:</p><ul><li>Access your data</li><li>Correct inaccurate data</li><li>Request deletion</li><li>Restrict or object to processing</li><li>Request a copy of your data</li></ul><p>To make a request, contact us at: <ContactEmail /></p></> },
  { n: 8, icon: 'shield', title: 'Data Security', body: <><p>We implement reasonable safeguards to protect your data.</p><p>However:</p><ul><li>No system is 100% secure</li><li>You use the Platform at your own risk</li></ul></> },
  { n: 9, icon: 'globe', title: 'International Users', body: <><p>If you access Hot Take from outside your country:</p><ul><li>Your data may be transferred and processed in other jurisdictions</li></ul></> },
  { n: 10, icon: 'children', title: 'Children’s Privacy', subtitle: '(18+ ONLY)', body: <><p>Hot Take is strictly 18+ only.</p><p>We do not knowingly collect data from minors.</p><p>If we discover such data, we will delete it.</p></> },
  { n: 11, icon: 'external', title: 'Third-Party Links', body: <><p>We are not responsible for:</p><ul><li>Third-party websites</li><li>External services linked on the Platform</li></ul></> },
  { n: 12, icon: 'edit', title: 'Changes to This Policy', body: <><p>We may update this Privacy Policy at any time.</p><p>Continued use of Hot Take means you accept the updated Policy.</p></> },
  { n: 13, icon: 'mail', title: 'Contact Information', body: <><p>For questions or requests, contact:</p><p>Email: <ContactEmail /></p><p>Company: Hot Take</p></> },
];

export default function PrivacyPolicy({ onBack, onPickLegal, embedded = false }) {
  const [isSignedIn, setIsSignedIn] = useState(Boolean(auth?.currentUser));
  const [authModal, setAuthModal] = useState(null);
  const [enlargedCard, setEnlargedCard] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return undefined;
    return onIdTokenChanged(auth, (user) => setIsSignedIn(Boolean(user)));
  }, []);

  useEffect(() => {
    if (!enlargedCard) return undefined;
    const handleKeyDown = (event) => { if (event.key === 'Escape') setEnlargedCard(null); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enlargedCard]);

  useEffect(() => {
    document.body.style.overflow = enlargedCard ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [enlargedCard]);

  const handleQuickMatch = () => {
    if (!isSignedIn) { setAuthModal('signin'); return; }
    window.location.assign('/?quickMatch=1');
  };

  const handleSignOut = async () => {
    try { if (auth) await signOut(auth); } catch { /* ignore */ }
    onBack?.();
  };

  const openCard = (card) => setEnlargedCard(card);
  const openLegal = (documentId) => onPickLegal?.(documentId);

  if (embedded) {
    return <article className="legal-doc-article legal-doc-article--embedded">
      <header className="legal-doc-header">
        <h1 className="legal-doc-title legal-doc-title--embedded">Hot Take – Privacy Policy</h1>
        <p className="legal-doc-meta">Effective date: March 22, 2026</p>
      </header>
      {cards.map((card) => <section className="legal-section" key={card.n}>
        <h2>{card.n}. {card.title}{card.subtitle ? ` ${card.subtitle}` : ''}</h2>
        {card.body}
      </section>)}
    </article>;
  }

  return <div className="privacy-policy-page">
    <SiteHeader onHome={onBack} onAbout={onBack} onTopics={handleQuickMatch} onFaq={onBack} onSupport={onBack} isSignedIn={isSignedIn} onSignIn={() => setAuthModal('signin')} onSignUp={() => setAuthModal('signup')} onSignOut={handleSignOut} onProfile={onBack} onPickLegal={openLegal} />

    <main className="privacy-policy-content">
      <aside className="privacy-intro">
        <h1>Privacy<br /><span>Policy</span></h1>
        <p className="privacy-meta">Effective date: <strong>March 22, 2026</strong></p>
        <p className="privacy-lead">Hot Take (“we,” “us,” or “our”) respects your privacy and is committed to protecting your personal information.</p>
        <p className="privacy-side-copy">This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Hot Take platform (“Platform”).</p>
        <p className="privacy-side-copy">By using Hot Take, you consent to the practices described in this Policy.</p>
        <h2 className="privacy-on-page-title">On this page</h2>
        <ol className="privacy-side-nav">
          {cards.map((card) => <li key={card.n}><button type="button" onClick={() => openCard(card)}><span>{card.n}.</span> <span>{card.title}{card.subtitle ? ` ${card.subtitle}` : ''}</span></button></li>)}
        </ol>
        <div className="privacy-side-card"><h3>Questions or requests?</h3><p>We’re here to help.</p><a href={contactEmailMailto() || '#'}>{contactEmailLabel()}</a></div>
      </aside>

      <section className="privacy-grid" aria-label="Privacy Policy sections">
        {cards.map((card) => <article className={`privacy-card privacy-card--${card.n}`} key={card.n}>
          <header>
            <PrivacyIcon type={card.icon} />
            <h2><span className="privacy-section-number">{card.n}.</span> {card.title} {card.subtitle && <small>{card.subtitle}</small>}</h2>
            <button type="button" className="privacy-enlarge-button" onClick={() => openCard(card)} aria-label={`Enlarge privacy policy section ${card.n}: ${card.title}`} title="Enlarge this section"><PrivacyIcon type="search" /></button>
          </header>
          <div className="privacy-card-body">{card.body}</div>
        </article>)}
        <p className="privacy-note">ⓘ This Privacy Policy is part of our <button type="button" onClick={() => openLegal('terms')}>Terms of Service</button> and <button type="button" className="privacy-community-link" onClick={() => openLegal('community')}>Community Guidelines</button>.</p>
      </section>
    </main>

    <SiteFooter onHome={onBack} onAbout={onBack} onFaq={onBack} onSupport={onBack} onPickLegal={openLegal} />

    {authModal && <AuthScreen variant="modal" initialMode={authModal} onClose={() => setAuthModal(null)} />}
    {enlargedCard && <div className="privacy-enlarge-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEnlargedCard(null); }}>
      <section className="privacy-enlarge-dialog" role="dialog" aria-modal="true" aria-labelledby={`privacy-dialog-title-${enlargedCard.n}`}>
        <header className="privacy-enlarge-dialog-header">
          <div className="privacy-enlarge-dialog-title"><PrivacyIcon type={enlargedCard.icon} /><h2 id={`privacy-dialog-title-${enlargedCard.n}`}>{enlargedCard.n}. {enlargedCard.title}{enlargedCard.subtitle ? ` ${enlargedCard.subtitle}` : ''}</h2></div>
          <button type="button" className="privacy-enlarge-close" onClick={() => setEnlargedCard(null)} aria-label="Close enlarged privacy policy section"><PrivacyIcon type="close" /></button>
        </header>
        <div className="privacy-enlarge-dialog-body">{enlargedCard.body}</div>
        <p className="privacy-enlarge-hint">Press Esc or select × to close.</p>
      </section>
    </div>}
  </div>;
}
