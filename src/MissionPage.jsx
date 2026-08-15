import { HotTakeWordmark, IconInstagram, IconReddit, IconX, IconYouTube } from './LandingAssets.jsx';
import HeaderNavMenu from './HeaderNavMenu.jsx';
import './MissionPage.css';
import './MissionHeaderFix.css';
import { SiteFooter, SiteHeader } from './SiteChrome.jsx';

function MissionIcon({ type }) {
  const shapes = {
    chat: <><path d="M5 6h13a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4h-5l-5 4v-4H5a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4Z" /><circle cx="7" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="17" cy="12" r="1" /></>,
    fire: <>
      <path d="M12 26c5.5 0 10-4.5 10-10 0-4.5-2.5-8-6-11 0 4-2 6-4 7 0-5-2-8-6-10 1 5-4 8-4 14 0 5.5 4.5 10 10 10Z" />
      <path d="M9 21c0 2 1.3 4 3 4s3-2 3-4c0-2-1-3-2-5 0 2-1 3-2 4 0-2-1-3-2-4 0 2-1 3-1 5Z" />
    </>,
    target: <><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="9" /><path d="M12 0v5M12 19v5M0 12h5M19 12h5" /></>,
    people: <><circle cx="8" cy="8" r="4" /><circle cx="18" cy="9" r="3" /><path d="M1 22c0-6 3-10 7-10s7 4 7 10M15 14c5 0 8 3 8 8" /></>,
  };
  return <svg viewBox="0 0 24 28" aria-hidden="true">{shapes[type]}</svg>;
}

const cards = [
  ['chat', 'Meaningful Conversations', 'We create space for real discussions that go beyond surface-level opinions and get to what really matters.'],
  ['fire', 'Passionate Debates', 'Debates are meant to be engaging and even heated. We give you the freedom to argue your point and challenge others.'],
  ['target', 'Challenge Ideas', 'We believe the best way to grow is to question, debate, and refine our perspectives.'],
  ['people', 'Stronger Together', 'By engaging with diverse viewpoints and real people, we build understanding across differences.'],
];

export default function MissionPage({ onBack, isSignedIn, onSignIn, onSignUp, onSignOut, onProfile, onPickLegal, onPickSupport, onQuickMatch }) {
  return <div className="mission-page">
    <SiteHeader onHome={onBack} onAbout={() => {}} onTopics={onBack} onQuickMatch={onQuickMatch} onFaq={onPickSupport} onSupport={onPickSupport} isSignedIn={isSignedIn} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile} onPickLegal={onPickLegal} />

    <main className="mission-content">
      <button className="mission-back" onClick={onBack}>&larr;&nbsp; Back to Home</button>
      <div className="mission-grid"><section className="mission-copy"><p className="mission-eyebrow">About Hot Take</p><h1>Our Mission</h1><i />
        <p>At Hot Take, our mission is to create a space where meaningful conversation can thrive. We believe that open dialogue&mdash;when structured with respect, clarity, and purpose&mdash;has the power to challenge ideas, expand perspectives, and bring people closer to truth.</p>
        <p>In a world where discussions are often fragmented or driven by noise, Hot Take is built to restore thoughtful exchange by encouraging users to engage directly, listen actively, and debate constructively.</p>
        <p>Our goal is not to silence differences, but to elevate them into conversations that are productive, insightful, and grounded in mutual respect.</p>
      </section><section className="mission-cards">{cards.map(([icon,title,copy]) => <article key={title}><span><MissionIcon type={icon} /></span><h2>{title}</h2><p>{copy}</p></article>)}</section></div>
      <blockquote><span>&ldquo;</span><div>Different views. Real people. No echo chambers.<strong>That&apos;s the Hot Take mission.</strong></div></blockquote>
    </main>

    <SiteFooter onHome={onBack} onAbout={() => {}} onFaq={onPickSupport} onSupport={onPickSupport} onPickLegal={onPickLegal} />
  </div>;
}
