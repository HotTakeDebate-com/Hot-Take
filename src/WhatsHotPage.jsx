import { useEffect, useMemo, useState } from 'react';
import { SiteFooter, SiteHeader } from './SiteChrome.jsx';
import './WhatsHotPage.css';

const FALLBACK_STORY = {
  id: 'candace-owens-vs-andrew-wilson-2026-08-14',
  title: 'Candace Owens vs. Andrew Wilson',
  category: 'Latest debate',
  summary: 'Candace Owens and Andrew Wilson meet for a long-form debate that has become a major topic across online debate communities.',
  body: 'Watch the full exchange, hear both sides in their own words, and form your own view.',
  videoUrl: 'https://www.youtube.com/watch?v=aPOyk1i2LOc&t=11251s',
  videoId: 'aPOyk1i2LOc',
  startSeconds: 11251,
  eventDate: '2026-08-14',
  featured: true,
};

function formatStoryDate(value) {
  if (!value) return 'Recently published';
  const date = new Date(value + 'T12:00:00');
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function StoryCard({ story }) {
  return (
    <article className="whats-hot-card">
      <div className="whats-hot-card-thumb">
        <img src={`https://img.youtube.com/vi/${story.videoId}/hqdefault.jpg`} alt="" loading="lazy" />
        <span aria-hidden="true">▶</span>
      </div>
      <div>
        <p>{story.category || 'Debate'} · {formatStoryDate(story.eventDate)}</p>
        <h3>{story.title}</h3>
        <p>{story.summary}</p>
        <a href={story.videoUrl} target="_blank" rel="noopener noreferrer">Watch debate <span aria-hidden="true">↗</span></a>
      </div>
    </article>
  );
}

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
  const [stories, setStories] = useState([FALLBACK_STORY]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/whats-hot')
      .then((response) => {
        if (!response.ok) throw new Error('Could not load stories.');
        return response.json();
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data.stories) && data.stories.length) setStories(data.stories);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const featured = useMemo(() => stories.find((story) => story.featured) || stories[0] || FALLBACK_STORY, [stories]);
  const moreStories = useMemo(() => stories.filter((story) => story.id !== featured.id), [stories, featured]);

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
          <header className="whats-hot-feature-heading">
            <p className="whats-hot-eyebrow">Main story</p>
            <p>The lead debate shaping the conversation right now.</p>
          </header>

          <div className="whats-hot-story">
            <div className="whats-hot-meta">
              <span>{featured.category || 'Featured debate'}</span>
              <time dateTime={featured.eventDate || undefined}>{formatStoryDate(featured.eventDate)}</time>
            </div>
            <h2 id="featured-debate-title">{featured.title}</h2>
            <p className="whats-hot-deck">{featured.summary}</p>
            {featured.body && <p className="whats-hot-summary">{featured.body}</p>}
            <a className="whats-hot-watch" href={featured.videoUrl} target="_blank" rel="noopener noreferrer">
              Watch the debate on YouTube
              <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div className="whats-hot-video">
            <div className="whats-hot-video-frame">
              <iframe
                src={`https://www.youtube.com/embed/${featured.videoId}?start=${featured.startSeconds || 0}`}
                title={featured.title + ' debate'}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <p>Full debate · Video begins at the supplied timestamp</p>
          </div>
        </section>

        {moreStories.length > 0 ? (
          <section className="whats-hot-latest" aria-labelledby="latest-stories-heading">
            <div className="whats-hot-latest-heading">
              <p className="whats-hot-eyebrow">Latest coverage</p>
              <h2 id="latest-stories-heading">More from debate media.</h2>
            </div>
            <div className="whats-hot-card-grid">{moreStories.map((story) => <StoryCard key={story.id} story={story} />)}</div>
          </section>
        ) : (
          <section className="whats-hot-more" aria-label="More debate coverage">
            <div>
              <p className="whats-hot-eyebrow">{loading ? 'Loading coverage' : 'The conversation continues'}</p>
              <h2>{loading ? 'Checking what’s happening now.' : 'More debates are coming.'}</h2>
            </div>
            <p>What&apos;s Hot will track noteworthy debates, exchanges, and moments from across debate media as they happen.</p>
          </section>
        )}
      </main>

      <SiteFooter onHome={onBack} onAbout={onPickMission} onFaq={onPickFaq} onSupport={onPickSupport} onPickLegal={onPickLegal} />
    </div>
  );
}
