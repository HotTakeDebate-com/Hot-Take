import BrandLogo from './BrandLogo.jsx';
import { TOPICS } from './topics.js';

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function StepIcon({ children, step }) {
  return (
    <div className="landing-step-icon" aria-hidden="true">
      {children}
      <span className="landing-step-badge">{step}</span>
    </div>
  );
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
          <BrandLogo className="brand-logo--landing-nav" />
        </a>

        <nav className="landing-nav-links" aria-label="Primary">
          <button type="button" className="landing-nav-link" onClick={() => scrollToId('how-it-works')}>
            How it works
          </button>
          <button type="button" className="landing-nav-link" onClick={() => scrollToId('about')}>
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
            <button type="button" className="btn btn-ghost landing-nav-btn" onClick={onSignOut}>
              Sign out
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost landing-nav-btn" onClick={onSignIn}>
                Sign in
              </button>
              <button type="button" className="btn btn-primary landing-nav-btn" onClick={onSignUp}>
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
            Have a take? Put it to the <em>test.</em>
          </h1>
          <p className="landing-subhead">
            Join a live 1-on-1 video debate with someone who sees things differently.
          </p>
          <ul className="landing-pills">
            <li>Real people</li>
            <li>No filters</li>
            <li>Just debate</li>
          </ul>
        </div>
        <div className="landing-hero-visual" aria-hidden="true">
          <BrandLogo className="brand-logo--landing-hero" />
        </div>
      </section>

      <section className="landing-cta-row" aria-label="Get started">
        <article className="landing-cta-card landing-cta-card--primary">
          <div className="landing-cta-icon landing-cta-icon--bolt" aria-hidden="true">
            ⚡
          </div>
          <h2 className="landing-cta-title">Quick match</h2>
          <p className="landing-cta-desc">
            Get matched instantly with someone who has an opposing take.
          </p>
          <button type="button" className="btn btn-primary landing-cta-btn" onClick={handleQuick}>
            Start quick match
          </button>
          <p className="landing-cta-foot">Perfect for jumping in and debating now.</p>
        </article>

        <div className="landing-cta-or" aria-hidden="true">
          or
        </div>

        <article className="landing-cta-card">
          <div className="landing-cta-icon" aria-hidden="true">
            +
          </div>
          <h2 className="landing-cta-title">Custom room</h2>
          <p className="landing-cta-desc">
            Create your own debate room, set the topic, and invite others.
          </p>
          <button type="button" className="btn btn-outline landing-cta-btn" onClick={handleCustom}>
            Create room
          </button>
          <p className="landing-cta-foot">Perfect for friends, communities, or events.</p>
        </article>
      </section>

      <section id="how-it-works" className="landing-section landing-how">
        <h2 className="landing-section-title">How it works</h2>
        <div className="landing-steps">
          <article className="landing-step">
            <StepIcon step="1">👤</StepIcon>
            <h3>Get matched</h3>
            <p>We pair you with someone who disagrees with you.</p>
          </article>
          <article className="landing-step">
            <StepIcon step="2">📹</StepIcon>
            <h3>Debate live</h3>
            <p>Hop on a 1-on-1 video call and make your case.</p>
          </article>
          <article className="landing-step">
            <StepIcon step="3">💬</StepIcon>
            <h3>Keep talking</h3>
            <p>Continue the conversation or debate someone new.</p>
          </article>
        </div>
      </section>

      <section id="about" className="landing-section landing-about">
        <h2 className="landing-section-title">About Hot Take</h2>
        <p className="landing-about-text">
          Hot Take is a live debate platform for real conversations and different perspectives.
          We believe open dialogue — when structured with respect and clarity — has the power to
          challenge ideas and bring people closer to truth.
        </p>
        <button type="button" className="landing-text-link" onClick={onPickMission}>
          Read our mission →
        </button>
      </section>

      <section id="topics" className="landing-section landing-topics">
        <h2 className="landing-section-title">Debate topics</h2>
        <p className="landing-section-lead">
          Quick match pairs you on curated statements like these — pick a side and meet your opponent.
        </p>
        <ul className="landing-topic-list">
          {TOPICS.map((t) => (
            <li key={t.id} className="landing-topic-item">
              {t.label}
            </li>
          ))}
        </ul>
      </section>

      <section id="faq" className="landing-section landing-faq">
        <h2 className="landing-section-title">FAQ</h2>
        <dl className="landing-faq-list">
          <div className="landing-faq-item">
            <dt>Do I need an account?</dt>
            <dd>Yes. Create a free account to join live debates, save your profile, and match with opponents.</dd>
          </div>
          <div className="landing-faq-item">
            <dt>What if I don&apos;t have a camera?</dt>
            <dd>
              You can still join with audio only. You&apos;ll hear your opponent and see their video if they
              have a camera.
            </dd>
          </div>
          <div className="landing-faq-item">
            <dt>How do I report someone?</dt>
            <dd>
              Use <strong>Report issue</strong> during a live debate. You can also email us from the Support
              page in the menu.
            </dd>
          </div>
        </dl>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <BrandLogo className="brand-logo--landing-footer" />
          <p>Hot Take is a live debate platform for real conversations and different perspectives.</p>
        </div>

        <div className="landing-footer-col">
          <h3>Company</h3>
          <ul>
            <li>
              <button type="button" onClick={() => scrollToId('about')}>
                About
              </button>
            </li>
            <li>
              <button type="button" onClick={() => scrollToId('how-it-works')}>
                How it works
              </button>
            </li>
            <li>
              <button type="button" onClick={() => scrollToId('faq')}>
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
              X
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              IG
            </a>
            <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
              TT
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              YT
            </a>
          </div>
        </div>
      </footer>

      <p className="landing-copyright">© {new Date().getFullYear()} Hot Take Debate. All rights reserved.</p>
    </div>
  );
}
