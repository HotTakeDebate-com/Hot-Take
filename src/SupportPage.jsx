import { IconShield, IconUser, IconVideo } from './LandingAssets.jsx';
import { contactEmailLabel, contactEmailMailto } from './legal/contactEmail.js';
import './SupportPage.css';
import './SupportLayoutFix.css';
import './SupportBubblyFix.css';
import { SiteFooter, SiteHeader } from './SiteChrome.jsx';

const items = [
  ['video', 'Camera or microphone not working?', 'Allow camera and microphone in your browser (lock icon in the address bar). On Windows, also check Settings → Privacy → Camera / Microphone and allow your browser. If you have no camera, you can still join with audio only — you should still hear your opponent and see their video when they have a camera.'],
  ['shield', 'Safety during a debate', 'If something goes wrong while you are matched with someone, use Report issue on the debate screen. Reports are reviewed by our team and help keep the community safe.'],
  ['user', 'Account & privacy', 'For terms, privacy, and community rules, open Menu in the header. Privacy requests (access, deletion, etc.) can also be sent to the contact email above.'],
  ['tool', 'Technical issues', 'Try refreshing the page, clearing your cache, or using another browser. If the problem continues, contact us with details about what happened.'],
  ['question', 'General questions', 'Check out our FAQ for answers to the most common questions about Hot Take.'],
];

function SupportIcon({ type }) {
  if (type === 'video') return <IconVideo />;
  if (type === 'shield') return <IconShield />;
  if (type === 'user') return <IconUser />;
  if (type === 'tool') return <svg viewBox="0 0 32 32"><path d="M19 5a7 7 0 0 0-8 9L3 22a3 3 0 0 0 4 4l8-8a7 7 0 0 0 9-8l-5 5-4-1-1-4 5-5Z" /></svg>;
  return <svg viewBox="0 0 32 32"><path d="M11 11a5 5 0 1 1 8 4c-2 1-3 2-3 5M16 25h.01" /></svg>;
}

export default function SupportPage({ onBack, isSignedIn, onSignIn, onSignUp, onSignOut, onProfile, onPickLegal, onPickMission, onPickFaq, onQuickMatch }) {
  const email = contactEmailLabel();
  const mailto = contactEmailMailto();

  return <div className="faq-page support-page">
    <SiteHeader onHome={onBack} onAbout={onPickMission} onTopics={onBack} onQuickMatch={onQuickMatch} onFaq={onPickFaq} onSupport={() => {}} isSignedIn={isSignedIn} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile} onPickLegal={onPickLegal} />
    <main className="support-content">
      <aside>
        <h1>Support</h1>
        <p>We&apos;re here to help. Find answers to common questions, troubleshooting tips, and ways to get in touch with our team.</p>
        <section className="support-contact">
          <div className="support-contact-title"><span><svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 28, height: 28, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg></span><h2>Contact us</h2></div>
          <p>For account help, privacy requests, technical issues, or general questions, email us at:</p>
          {mailto ? <a href={mailto}>{email}</a> : <b>{email}</b>}
          <p>We aim to reply within a few business days.</p>
          <hr />
          <h3>Other ways to reach us</h3>
          <p><strong>𝕏 (Twitter)</strong><br />@HotTakeDebate</p>
          <p><strong>Instagram</strong><br />@HotTakeDebate</p>
          <p><strong>Feedback &amp; Suggestions</strong><br />Help us improve Hot Take</p>
        </section>
      </aside>
      <div className="support-list" aria-label="Support topics">
        {items.map(([icon, title, copy]) => <article key={title}>
          <span><SupportIcon type={icon} /></span>
          <div><h2>{title}</h2><p>{copy}</p>{icon === 'question' && <button type="button" onClick={onPickFaq}>View FAQ</button>}</div>
        </article>)}
      </div>
    </main>
    <div className="support-bottom">Still need help? Email us at {mailto ? <a href={mailto}>{email}</a> : <b>{email}</b>} and we&apos;ll get back to you.</div>
    <SiteFooter onHome={onBack} onAbout={onPickMission} onFaq={onPickFaq} onSupport={() => {}} onPickLegal={onPickLegal} />
  </div>;
}
