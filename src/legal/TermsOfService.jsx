import { useEffect, useState } from 'react';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import AuthScreen from '../AuthScreen.jsx';
import { auth, isFirebaseConfigured } from '../firebase.js';
import { SiteFooter, SiteHeader } from '../SiteChrome.jsx';
import { contactEmailLabel, contactEmailMailto } from './contactEmail.js';
import { PrivacyIcon } from './PrivacyPolicy.jsx';
import './PrivacyPolicy.css';
import './TermsOfService.css';

const cards = [
  { n: 1, icon: 'edit', title: 'Acceptance of Terms', body: <p>By accessing or using Hot Take (“the Platform,” “we,” “us,” or “our”), you agree to be bound by these Terms of Service (“Terms”). If you do not agree, you must not use the Platform.</p> },
  { n: 2, icon: 'children', title: 'Eligibility', subtitle: '(18+ ONLY)', body: <><p>You must:</p><ul><li>Be at least 18 years old</li><li>Have the legal capacity to enter into a binding agreement</li><li>Comply with all applicable laws</li></ul><p>By using Hot Take, you represent and warrant that you meet these requirements.</p><p>We reserve the right to request age verification and suspend or terminate accounts suspected of being underage.</p></> },
  { n: 3, icon: 'globe', title: 'Description of Service', body: <><p>Hot Take is a debate-focused social platform that allows users to:</p><ul><li>Participate in live and recorded debates</li><li>Upload, share, and view content</li><li>Engage in matchmaking and public discussions</li><li>Follow and interact with other users</li></ul><p>We may modify, suspend, or discontinue any part of the Platform at any time without notice.</p></> },
  { n: 4, icon: 'user', title: 'User Accounts', body: <><p>You are responsible for maintaining the confidentiality of your account and all activity under it.</p><p>You agree not to:</p><ul><li>Share or transfer your account</li><li>Create accounts for others</li><li>Use false or misleading information</li></ul><p>We may terminate or suspend accounts at our sole discretion.</p></> },
  { n: 5, icon: 'people', title: 'User Conduct', body: <><p>You agree NOT to:</p><ul><li>Violate any law or regulation</li><li>Engage in harassment, threats, or abuse</li><li>Promote violence, terrorism, or criminal activity</li><li>Share private information without consent</li><li>Impersonate any person or entity</li><li>Attempt to hack, exploit, or disrupt the Platform</li></ul><p>Open discussion is supported, but illegal conduct and direct harm are strictly prohibited.</p></> },
  { n: 6, icon: 'database', title: 'User Content & License', body: <><p>You retain ownership of your content.</p><p>By submitting content, you grant Hot Take a worldwide, non-exclusive, royalty-free, sublicensable, transferable license to use, host, store, reproduce, modify, publish, distribute, and display it.</p><p>This includes live debates, recorded content, clips, and posts. This license continues even if your content is removed.</p></> },
  { n: 7, icon: 'external', title: 'Recording, Streaming & Public Use', body: <><p>By using Hot Take, you acknowledge and agree:</p><ul><li>All debates may be recorded, stored, and publicly distributed</li><li>Content may be used for promotion, marketing, or platform growth</li><li>You waive claims related to recording or public use of your participation</li></ul></> },
  { n: 8, icon: 'target', title: 'AI Moderation & Platform Control', body: <><p>Hot Take may use automated systems, including AI, to moderate content, structure debates, and enforce rules.</p><p>You acknowledge that AI systems may not be perfect and decisions may be made automatically.</p><p>We reserve full discretion to remove content, limit visibility, and suspend or ban users.</p></> },
  { n: 9, icon: 'money', title: 'Monetization & Platform Rights', body: <><p>Hot Take reserves the right to:</p><ul><li>Display advertisements</li><li>Monetize user content</li><li>Offer paid features, subscriptions, or promotions</li></ul><p>You are not entitled to compensation unless explicitly agreed in writing.</p></> },
  { n: 10, icon: 'rights', title: 'Copyright & DMCA Policy', body: <><p>If you believe your copyrighted work has been used improperly, you may submit a DMCA takedown request.</p><p>We will remove infringing content where appropriate and terminate repeat offenders. False claims may result in liability.</p></> },
  { n: 11, icon: 'external', title: 'Third-Party Content', body: <><p>Hot Take is not responsible for content posted by users, opinions expressed during debates, external links, or third-party services.</p><p>You access such content at your own risk.</p></> },
  { n: 12, icon: 'headset', title: 'No Professional Advice', body: <><p>Content on Hot Take is for informational and entertainment purposes only.</p><p>It does not constitute medical, legal, or financial advice.</p></> },
  { n: 13, icon: 'shield', title: 'Disclaimer of Warranties', body: <><p>The Platform is provided “as is” and “as available.”</p><p>We make no guarantees regarding reliability, accuracy, availability, or security.</p></> },
  { n: 14, icon: 'shield', title: 'Limitation of Liability', body: <><p>To the fullest extent permitted by law, Hot Take shall not be liable for:</p><ul><li>Indirect, incidental, or consequential damages</li><li>Loss of data, profits, or reputation</li><li>User disputes or interactions</li></ul><p>Your use of the Platform is at your own risk.</p></> },
  { n: 15, icon: 'people', title: 'Indemnification', body: <><p>You agree to defend and indemnify Hot Take against claims arising from:</p><ul><li>Your use of the Platform</li><li>Your content</li><li>Your violation of these Terms</li></ul></> },
  { n: 16, icon: 'rights', title: 'Arbitration & Dispute Resolution', subtitle: '(CRITICAL)', body: <><p>Any disputes arising from these Terms will be resolved through:</p><p><strong>Binding arbitration, not court.</strong></p><p>You waive your right to a jury trial and participation in class action lawsuits.</p><p>Arbitration will be conducted in accordance with applicable arbitration rules.</p></> },
  { n: 17, icon: 'close', title: 'Termination', body: <p>We may suspend or terminate your access at any time, for any reason, without notice.</p> },
  { n: 18, icon: 'edit', title: 'Changes to Terms', body: <><p>We may update these Terms at any time.</p><p>Continued use of Hot Take means acceptance of updated Terms.</p></> },
  { n: 19, icon: 'globe', title: 'Governing Law', body: <p>These Terms are governed by the laws of the jurisdiction in which Hot Take operates.</p> },
];

export default function TermsOfService({ onBack, onPickLegal, embedded = false }) {
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

  if (embedded) return <article className="legal-doc-article legal-doc-article--embedded">
    <header className="legal-doc-header"><h1 className="legal-doc-title legal-doc-title--embedded">Hot Take – Terms of Service</h1><p className="legal-doc-meta">Effective date: March 22, 2026</p></header>
    {cards.map((card) => <section className="legal-section" key={card.n}><h2>{card.n}. {card.title}{card.subtitle ? ` ${card.subtitle}` : ''}</h2>{card.body}</section>)}
  </article>;

  const handleQuickMatch = () => {
    if (!isSignedIn) { setAuthModal('signin'); return; }
    window.location.assign('/?quickMatch=1');
  };
  const handleSignOut = async () => { try { if (auth) await signOut(auth); } catch { /* ignore */ } onBack?.(); };
  const openLegal = (documentId) => onPickLegal?.(documentId);

  return <div className="privacy-policy-page terms-policy-page legal-traditional-page">
    <SiteHeader onHome={onBack} onAbout={onBack} onTopics={handleQuickMatch} onFaq={onBack} onSupport={onBack} isSignedIn={isSignedIn} onSignIn={() => setAuthModal('signin')} onSignUp={() => setAuthModal('signup')} onSignOut={handleSignOut} onProfile={onBack} onPickLegal={openLegal} />
    <main className="privacy-policy-content">
      <aside className="privacy-intro">
        <h1>Terms of<br /><span>Service</span></h1>
        <p className="privacy-meta">Effective date: <strong>March 22, 2026</strong></p>
        <p className="privacy-lead">These Terms explain the rules and responsibilities that apply when you access or use Hot Take.</p>
        <p className="privacy-side-copy">By using the Platform, you agree to these Terms. If you do not agree, you must not use Hot Take.</p>
        <h2 className="privacy-on-page-title">On this page</h2>
        <ol className="privacy-side-nav">{cards.map((card) => <li key={card.n}><button type="button" onClick={() => setEnlargedCard(card)}><span>{card.n}.</span><span>{card.title}{card.subtitle ? ` ${card.subtitle}` : ''}</span></button></li>)}</ol>
        <div className="privacy-side-card"><h3>Questions about these terms?</h3><p>We’re here to help.</p><a href={contactEmailMailto() || '#'}>{contactEmailLabel()}</a></div>
      </aside>
      <section className="privacy-grid terms-grid" aria-label="Terms of Service sections">
        {cards.map((card) => <article className="privacy-card terms-card" key={card.n}><header><PrivacyIcon type={card.icon} /><h2><span className="privacy-section-number">{card.n}.</span> {card.title} {card.subtitle && <small>{card.subtitle}</small>}</h2><button type="button" className="privacy-enlarge-button" onClick={() => setEnlargedCard(card)} aria-label={`Enlarge terms section ${card.n}: ${card.title}`}><PrivacyIcon type="search" /></button></header><div className="privacy-card-body">{card.body}</div></article>)}
        <p className="privacy-note">ⓘ These Terms work together with our <button type="button" onClick={() => openLegal('privacy')}>Privacy Policy</button>, <button type="button" onClick={() => openLegal('recording')}>Recording Agreement</button>, and <button type="button" onClick={() => openLegal('community')}>Community Guidelines</button>.</p>
      </section>
    </main>
    <SiteFooter onHome={onBack} onAbout={onBack} onFaq={onBack} onSupport={onBack} onPickLegal={openLegal} />
    {authModal && <AuthScreen variant="modal" initialMode={authModal} onClose={() => setAuthModal(null)} />}
    {enlargedCard && <div className="privacy-enlarge-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEnlargedCard(null); }}><section className="privacy-enlarge-dialog" role="dialog" aria-modal="true" aria-labelledby={`terms-dialog-title-${enlargedCard.n}`}><header className="privacy-enlarge-dialog-header"><div className="privacy-enlarge-dialog-title"><PrivacyIcon type={enlargedCard.icon} /><h2 id={`terms-dialog-title-${enlargedCard.n}`}>{enlargedCard.n}. {enlargedCard.title}{enlargedCard.subtitle ? ` ${enlargedCard.subtitle}` : ''}</h2></div><button type="button" className="privacy-enlarge-close" onClick={() => setEnlargedCard(null)} aria-label="Close enlarged terms section"><PrivacyIcon type="close" /></button></header><div className="privacy-enlarge-dialog-body">{enlargedCard.body}</div><p className="privacy-enlarge-hint">Press Esc or select × to close.</p></section></div>}
  </div>;
}
