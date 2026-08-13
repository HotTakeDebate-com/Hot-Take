import {
  HotTakeWordmark, IconInstagram, IconReddit, IconX, IconYouTube,
} from './LandingAssets.jsx';
import HeaderNavMenu from './HeaderNavMenu.jsx';
import './MissionPage.css';
import './MissionHeaderFix.css';

function MissionIcon({ type }) {
  const shapes = {
    chat: <><path d="M5 6h13a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4h-5l-5 4v-4H5a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4Z" /><circle cx="7" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="17" cy="12" r="1" /></>,
    fire: <path d="M13 2c2 5-2 7 1 10 2-2 3-4 3-6 4 4 6 8 5 12-1 5-5 8-10 8S3 23 3 18c0-4 2-7 6-11 0 4 1 6 2 7 1-3 0-7 2-12Zm-1 23c3 0 5-2 5-5 0-2-1-4-3-6 0 3-3 4-3 7-1-1-1-2-1-4-2 2-3 4-3 5 0 2 2 3 5 3Z" />,
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

export default function MissionPage({ onBack, isSignedIn, onSignIn, onSignUp, onSignOut, onProfile, onPickLegal, onPickSupport }) {
  return <div className="mission-page">
    <header className="mission-nav">
      <button className="mission-brand" onClick={onBack}><HotTakeWordmark variant="nav" /></button>
      <nav><button onClick={onBack}>How it works</button><button className="active">About</button><button onClick={onBack}>Topics</button><button onClick={onBack}>FAQ</button></nav>
      <div>{isSignedIn ? <><button className="mission-pill" onClick={onProfile}>Profile</button><HeaderNavMenu variant="landing" onPickLegal={onPickLegal} onPickMission={() => {}} onPickSupport={onPickSupport} /><button className="mission-pill" onClick={onSignOut}>Sign out</button></> : <><button className="mission-pill" onClick={onSignIn}>Sign in</button><button className="mission-pill mission-pill--red" onClick={onSignUp}>Create account</button></>}</div>
    </header>

    <main className="mission-content">
      <button className="mission-back" onClick={onBack}>&larr;&nbsp; Back to Home</button>
      <div className="mission-grid"><section className="mission-copy"><p className="mission-eyebrow">About Hot Take</p><h1>Our Mission</h1><i />
        <p>At Hot Take, our mission is to create a space where meaningful conversation can thrive. We believe that open dialogue&mdash;when structured with respect, clarity, and purpose&mdash;has the power to challenge ideas, expand perspectives, and bring people closer to truth.</p>
        <p>In a world where discussions are often fragmented or driven by noise, Hot Take is built to restore thoughtful exchange by encouraging users to engage directly, listen actively, and debate constructively.</p>
        <p>Our goal is not to silence differences, but to elevate them into conversations that are productive, insightful, and grounded in mutual respect.</p>
      </section><section className="mission-cards">{cards.map(([icon,title,copy]) => <article key={title}><span><MissionIcon type={icon} /></span><h2>{title}</h2><p>{copy}</p></article>)}</section></div>
      <blockquote><span>&ldquo;</span><div>Different views. Real people. No echo chambers.<strong>That&apos;s the Hot Take mission.</strong></div></blockquote>
    </main>

    <footer className="mission-footer"><HotTakeWordmark variant="footer" /><p>&copy; 2026 Hot Take Debate. All rights reserved.</p><div><span>Follow us</span><a href="https://x.com" aria-label="X"><IconX /></a><a href="https://instagram.com" aria-label="Instagram"><IconInstagram /></a><a href="https://reddit.com" aria-label="Reddit"><IconReddit /></a><a href="https://youtube.com" aria-label="YouTube"><IconYouTube /></a></div></footer>
  </div>;
}
