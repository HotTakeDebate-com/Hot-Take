import { SiteFooter, SiteHeader } from './SiteChrome.jsx';
import './WhatsHotPage.css';

const FEATURED_VIDEO_URL = 'https://www.youtube.com/watch?v=aPOyk1i2LOc&t=11251s';

export default function WhatsHotPage({
  onBack,
  isSignedIn,
  onSignIn,
  onSignUp,
  onSignOut,
  onProfile,
  onPickLegal,
  onPickMission,
  onPickFaq,
  onPickSupport,
  onQuickMatch,
}) {
  return (
    <div className="whats-hot-page">
      <SiteHeader
        onHome={onBack}
        onAbout={onPickMission}
        onTopics={onQuickMatch}
        onQuickMatch={onQuickMatch}
        onFaq={onPickFaq}
        onSupport={onPickSupport}
        isSignedIn={isSignedIn}
        onSignIn={onSignIn}
        onSignUp={onSignUp}
        onSignOut={onSignOut}
        onProfile={onProfile}
        onPickLegal={onPickLegal}
      />

      <main className="whats-hot-main">
        <header className="whats-hot-intro">
          <p className="whats-hot-eyebrow">Debate media</p>
          <h1>What&apos;s Hot<span>.</span></h1>
          <p>The debates shaping the conversation right now—presented without declaring a winner, so you can watch and decide for yourself.</p>
        </header>

        <section className="whats-hot-feature" aria-labelledby="featured-debate-title">
          <div className="whats-hot-story">
            <div className="whats-hot-meta">
              <span>Latest debate</span>
              <time dateTime="2026-08-14">August 14, 2026</time>
            </div>
            <h2 id="featured-debate-title">Candace Owens vs. Andrew Wilson</h2>
            <p className="whats-hot-deck">
              Candace Owens and Andrew Wilson meet for a long-form debate that has become a major topic across online debate communities.
            </p>
            <p className="whats-hot-summary">
              Watch the full exchange, hear both sides in their own words, and form your own view.
            </p>
            <a className="whats-hot-watch" href={FEATURED_VIDEO_URL} target="_blank" rel="noopener noreferrer">
              Watch the debate on YouTube
              <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div className="whats-hot-video">
            <div className="whats-hot-video-frame">
              <iframe
                src="https://www.youtube.com/embed/aPOyk1i2LOc?start=11251"
                title="Candace Owens versus Andrew Wilson debate"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <p>Full debate · Video begins at the supplied timestamp</p>
          </div>
        </section>

        <section className="whats-hot-more" aria-label="More debate coverage">
          <div>
            <p className="whats-hot-eyebrow">The conversation continues</p>
            <h2>More debates are coming.</h2>
          </div>
          <p>What&apos;s Hot will track noteworthy debates, exchanges, and moments from across debate media as they happen.</p>
        </section>
      </main>

      <SiteFooter
        onHome={onBack}
        onAbout={onPickMission}
        onFaq={onPickFaq}
        onSupport={onPickSupport}
        onPickLegal={onPickLegal}
      />
    </div>
  );
}
