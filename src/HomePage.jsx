import {
  HeroBubblesVisual,
  HotTakeWordmark,
  IconInstagram,
  IconLightning,
  IconShield,
  IconTikTok,
  IconUser,
  IconUserPlus,
  IconVideo,
  IconX,
  IconYouTube,
  StepIconChat,
  StepIconDebate,
  StepIconMatch,
} from './LandingAssets.jsx';

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function HomePage({
  isSignedIn,
  onSignIn,
  onSignUp,
  onSignOut,
  onQuickMatch,
  onCustomRoom,
  onPickLegal,
  onPickMission,
  onPickSupport,
  navExtras,
}) {
  const handleQuick = () => {
    if (!isSignedIn) onSignIn();
    else onQuickMatch();
  };

  const handleCustom = () => {
    if (!isSignedIn) onSignIn();
    else onCustomRoom();
  };

  return (
    <div className="landing">
      <header className="landing-nav">
        <a href="/" className="landing-nav-brand" onClick={(e) => e.preventDefault()}>
          <HotTakeWordmark variant="nav" />
        </a>

        <nav className="landing-nav-links" aria-label="Primary">
          <button type="button" className="landing-nav-link" onClick={() => scrollToId('how-it-works')}>
            How it works
          </button>
          <button type="button" className="landing-nav-link" onClick={onPickMission}>
            About
          </button>
          <button type="button" className="landing-nav-link" onClick={() => scrollToId('topics')}>
            Topics
          </button>
          <button type="button" className="landing-nav-link" onClick={() => scrollToId('faq')}>
            FAQ
          </button>
        </nav>

        <div className="landing-nav-actions">
          {navExtras}
          {isSignedIn ? (
            <button type="button" className="landing-btn landing-btn--ghost" onClick={onSignOut}>
              Sign out
            </button>
          ) : (
            <>
              <button type="button" className="landing-btn landing-btn--ghost" onClick={onSignIn}>
                Sign in
              </button>
              <button type="button" className="landing-btn landing-btn--primary" onClick={onSignUp}>
                Create account
              </button>
            </>
          )}
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">Live 1-on-1 debates</p>
          <h1 className="landing-headline">
            Have a take?<br />Put it to <span className="landing-headline-accent">the test.</span>
          </h1>
          <p className="landing-subhead">
            Join a live 1-on-1 video debate with someone who sees things differently.
          </p>
          <ul className="landing-features">
            <li>
              <IconUser />
              Real people
            </li>
            <li>
              <IconShield />
              No filters
            </li>
            <li>
              <IconVideo />
              Just debate
            </li>
          </ul>
        </div>
        <div className="landing-hero-visual">
          <HeroBubblesVisual />
        </div>
      </section>

      <section className="landing-cta-row" aria-label="Get started">
        <article className="landing-cta-card landing-cta-card--primary">
          <div className="landing-cta-icon landing-cta-icon--red" aria-hidden="true">
            <IconLightning />
          </div>
          <h2 className="landing-cta-title">Quick match</h2>
          <p className="landing-cta-desc">
            Get matched instantly with someone who has an opposing take.
          </p>
          <button type="button" className="landing-btn landing-btn--primary landing-cta-btn" onClick={handleQuick}>
            Start quick match
          </button>
          <p className="landing-cta-foot">Perfect for jumping in and debating now.</p>
        </article>

        <div className="landing-cta-or" aria-hidden="true">
          or
        </div>

        <article className="landing-cta-card">
          <div className="landing-cta-icon" aria-hidden="true">
            <IconUserPlus />
          </div>
          <h2 className="landing-cta-title">Custom room</h2>
          <p className="landing-cta-desc">
            Create your own debate room, set the topic, and invite others.
          </p>
          <button type="button" className="landing-btn landing-btn--outline landing-cta-btn" onClick={handleCustom}>
            Create room
          </button>
          <p className="landing-cta-foot">Perfect for friends, communities, or events.</p>
        </article>
      </section>

      <section id="how-it-works" className="landing-how">
        <h2 className="landing-how-title">How it works</h2>
        <div className="landing-steps">
          <article className="landing-step">
            <StepIconMatch step="1" />
            <h3>Get matched</h3>
            <p>We pair you with someone who disagrees with you.</p>
          </article>
          <article className="landing-step">
            <StepIconDebate step="2" />
            <h3>Debate live</h3>
            <p>Hop on a 1-on-1 video call and make your case.</p>
          </article>
          <article className="landing-step">
            <StepIconChat step="3" />
            <h3>Keep talking</h3>
            <p>Continue the conversation or debate someone new.</p>
          </article>
        </div>
      </section>

      {/* Hidden anchor targets for nav links */}
      <div id="topics" className="landing-anchor" aria-hidden="true" />
      <div id="faq" className="landing-anchor" aria-hidden="true" />

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <HotTakeWordmark variant="footer" />
          <p>Hot Take is a live debate platform for real conversations and different perspectives.</p>
        </div>

        <div className="landing-footer-col">
          <h3>Company</h3>
          <ul>
            <li>
              <button type="button" onClick={onPickMission}>
                About
              </button>
            </li>
            <li>
              <button type="button" onClick={() => scrollToId('how-it-works')}>
                How it works
              </button>
            </li>
            <li>
              <button type="button" onClick={onPickSupport}>
                FAQ
              </button>
            </li>
            <li>
              <button type="button" onClick={onPickSupport}>
                Contact
              </button>
            </li>
          </ul>
        </div>

        <div className="landing-footer-col">
          <h3>Support</h3>
          <ul>
            <li>
              <button type="button" onClick={onPickSupport}>
                Help center
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onPickLegal('community')}>
                Community guidelines
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onPickLegal('privacy')}>
                Privacy policy
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onPickLegal('terms')}>
                Terms of service
              </button>
            </li>
          </ul>
        </div>

        <div className="landing-footer-col landing-footer-social">
          <h3>Follow us</h3>
          <div className="landing-social-row">
            <a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="X">
              <IconX />
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <IconInstagram />
            </a>
            <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
              <IconTikTok />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <IconYouTube />
            </a>
          </div>
        </div>

        <p className="landing-copyright">? {new Date().getFullYear()} Hot Take Debate. All rights reserved.</p>
      </footer>
    </div>
  );
}
