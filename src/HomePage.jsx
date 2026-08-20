import { useEffect, useRef, useState } from 'react';
import {
  HotTakeWordmark,
  IconInstagram,
  IconLightning,
  IconReddit,
  IconX,
  IconYouTube,
  StepIconChat,
  StepIconDebate,
  StepIconMatch,
} from './LandingAssets.jsx';
import { SiteHeader } from './SiteChrome.jsx';
import { auth } from './firebase.js';

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const HOME_QUOTES = [
  {
    category: 'Debate & disagreement',
    quote: 'It is the mark of an educated mind to be able to entertain a thought without accepting it.',
    author: 'Aristotle',
    date: 'Date unknown · modern paraphrase',
    note: 'Not an authenticated Aristotle quotation.',
  },
  {
    category: 'Debate & disagreement',
    quote: 'When the debate is lost, slander becomes the tool of the loser.',
    author: 'Attributed to Socrates',
    date: 'Modern · circulating online by 2006',
    note: 'There is no evidence that Socrates said this.',
  },
  {
    category: 'Free speech',
    quote: 'I disapprove of what you say, but I will defend to the death your right to say it.',
    author: 'Evelyn Beatrice Hall',
    date: '1906',
    source: 'The Friends of Voltaire — written as a summary of Voltaire\'s attitude.',
  },
  {
    category: 'Debate & disagreement',
    quote: 'He who knows only his own side of the case knows little of that.',
    author: 'John Stuart Mill',
    date: '1859',
    source: 'On Liberty',
  },
  {
    category: 'Free speech',
    quote: 'If liberty means anything at all it means the right to tell people what they do not want to hear.',
    author: 'George Orwell',
    date: '1945',
    source: 'Proposed preface to Animal Farm, “The Freedom of the Press.”',
  },
  {
    category: 'Truth & seeking truth',
    quote: 'All truths are easy to understand once they are discovered; the point is to discover them.',
    author: 'Attributed to Galileo Galilei',
    date: 'Date uncertain',
    note: 'Widely attributed to Galileo; a specific year is not established here.',
  },
  {
    category: 'Truth & seeking truth',
    quote: 'There are two ways to be fooled. One is to believe what isn\'t true; the other is to refuse to believe what is true.',
    author: 'Attributed to Søren Kierkegaard',
    date: 'Date unknown',
    note: 'The attribution is questionable.',
  },
  {
    category: 'Thinking for yourself',
    quote: 'It is dangerous to be right in matters on which the established authorities are wrong.',
    author: 'Attributed to Voltaire',
    date: 'Date uncertain',
    note: 'The precise provenance is uncertain.',
  },
  {
    category: 'Thinking for yourself',
    quote: 'The greatest enemy of knowledge is not ignorance, it is the illusion of knowledge.',
    author: 'Attributed to Stephen Hawking',
    date: 'Date uncertain',
    note: 'Often attributed to Hawking, but the provenance is not firmly established.',
  },
  {
    category: 'Evil, morality & standing up',
    quote: 'The only thing necessary for the triumph of evil is for good men to do nothing.',
    author: 'Unknown · traditionally attributed to Edmund Burke',
    date: 'Date unknown',
    note: 'The familiar wording is not authenticated as an Edmund Burke quotation.',
  },
  {
    category: 'Evil, morality & standing up',
    quote: 'The world will not be destroyed by those who do evil, but by those who watch them without doing anything.',
    author: 'Attributed to Albert Einstein',
    date: 'Date unknown',
    note: 'The attribution is questionable.',
  },
  {
    category: 'Evil, morality & standing up',
    quote: 'In the end, we will remember not the words of our enemies, but the silence of our friends.',
    author: 'Martin Luther King Jr.',
    date: '1960s',
    note: 'Associated with King’s civil-rights-era speeches and writings; an exact source is not specified here.',
  },
  {
    category: 'Evil, morality & standing up',
    quote: 'Whoever fights monsters should see to it that in the process he does not become a monster.',
    author: 'Friedrich Nietzsche',
    date: '1886',
    source: 'Beyond Good and Evil',
  },
  {
    category: 'Evil, morality & standing up',
    quote: 'The line separating good and evil passes not through states, nor between classes, nor between political parties either—but right through every human heart.',
    author: 'Aleksandr Solzhenitsyn',
    date: '1973',
    source: 'The Gulag Archipelago',
  },
  {
    category: 'Free speech',
    quote: 'Whoever would overthrow the liberty of a nation must begin by subduing the freeness of speech.',
    author: 'Benjamin Franklin',
    date: 'July 9, 1722',
    source: 'Silence Dogood No. 8',
    note: 'Franklin introduced the passage as an extract from the London Journal.',
  },
  {
    category: 'Free speech',
    quote: 'If freedom of speech is taken away, then dumb and silent we may be led, like sheep to the slaughter.',
    author: 'Attributed to George Washington',
    date: 'Date uncertain',
    note: 'The precise provenance is uncertain.',
  },
];

// Intentionally retained for a future homepage or editorial feature.
// Change this to true to restore the existing quote carousel in its original position.
const SHOW_HOME_QUOTES = false;

const QUOTE_DURATION_MS = 15000;
const QUOTE_FADE_MS = 400;

function QuoteCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const transitionTimerRef = useRef(null);
  const isTransitioningRef = useRef(false);
  const quote = HOME_QUOTES[index];

  const show = (nextIndex) => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsFading(true);
    transitionTimerRef.current = window.setTimeout(() => {
      setIndex((nextIndex + HOME_QUOTES.length) % HOME_QUOTES.length);
      setIsFading(false);
      isTransitioningRef.current = false;
      transitionTimerRef.current = null;
    }, QUOTE_FADE_MS);
  };

  useEffect(() => {
    if (paused) return undefined;
    const timer = window.setInterval(
      () => {
        if (isTransitioningRef.current) return;
        isTransitioningRef.current = true;
        setIsFading(true);
        transitionTimerRef.current = window.setTimeout(() => {
          setIndex((current) => (current + 1) % HOME_QUOTES.length);
          setIsFading(false);
          isTransitioningRef.current = false;
          transitionTimerRef.current = null;
        }, QUOTE_FADE_MS);
      },
      QUOTE_DURATION_MS
    );
    return () => window.clearInterval(timer);
  }, [paused]);

  useEffect(() => () => {
    if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
  }, []);

  return (
    <section
      className="landing-quotes"
      aria-labelledby="landing-quotes-title"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="landing-quotes-heading">
        <div>
          <p className="landing-quotes-eyebrow">Ideas worth debating</p>
          <h2 id="landing-quotes-title">Think deeper<span>.</span></h2>
        </div>
        <p>A rotating collection of ideas that shaped how we disagree, question, and speak freely.</p>
      </div>

      <div className="landing-quote-stage">
        <button className="landing-quote-arrow landing-quote-arrow--previous" type="button" onClick={() => show(index - 1)} aria-label="Previous quote">←</button>
        <article className={`landing-quote-card${isFading ? ' is-fading' : ''}`} aria-live="polite">
          <span className="landing-quote-mark" aria-hidden="true">“</span>
          <div className="landing-quote-content">
            <div className="landing-quote-category"><span aria-hidden="true" />{quote.category}</div>
            <blockquote>{quote.quote}</blockquote>
            <footer>
              <div className="landing-quote-author">
                <strong>{quote.author}</strong>
                <span>{quote.date}</span>
              </div>
              <span className="landing-quote-count"><b>{String(index + 1).padStart(2, '0')}</b><i />{String(HOME_QUOTES.length).padStart(2, '0')}</span>
            </footer>
            {(quote.source || quote.note) && (
              <div className="landing-quote-context">
                {quote.source && <p className="landing-quote-source"><span>Source</span><cite>{quote.source}</cite></p>}
                {quote.note && <p className="landing-quote-note"><span aria-hidden="true">i</span>{quote.note}</p>}
              </div>
            )}
          </div>
        </article>
        <button className="landing-quote-arrow landing-quote-arrow--next" type="button" onClick={() => show(index + 1)} aria-label="Next quote">→</button>
      </div>

      <div className="landing-quote-controls">
        <span>Explore the collection</span>
        <div className="landing-quote-dots" aria-label="Choose a quote">
          {HOME_QUOTES.map((item, itemIndex) => (
            <button
              key={item.quote}
              type="button"
              className={itemIndex === index ? 'active' : ''}
              onClick={() => show(itemIndex)}
              aria-label={`Show quote ${itemIndex + 1}`}
              aria-current={itemIndex === index ? 'true' : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function LiveOnHotTake({ onQuickMatch, onCustomRoom }) {
  const [stats, setStats] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/live-stats', { cache: 'no-store' });
        if (!response.ok) throw new Error('Live activity unavailable');
        const next = await response.json();
        if (!active) return;
        setStats({
          onlineUsers: Math.max(0, Number(next.onlineUsers) || 0),
          activeDebates: Math.max(0, Number(next.activeDebates) || 0),
          searchingUsers: Math.max(0, Number(next.searchingUsers) || 0),
        });
        setUnavailable(false);
      } catch {
        if (active) setUnavailable(true);
      }
    };

    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const cards = [
    { key: 'onlineUsers', label: 'Online now', detail: 'Members connected', tone: 'green' },
    { key: 'activeDebates', label: 'Live debates', detail: 'Conversations happening', tone: 'red' },
    { key: 'searchingUsers', label: 'Finding a match', detail: 'Ready to debate', tone: 'amber' },
  ];

  return (
    <section className="landing-live-section" aria-labelledby="landing-live-title">
      <div className="landing-live-intro">
        <p className="landing-live-kicker"><span aria-hidden="true" />Live on Hot Take</p>
        <h2 id="landing-live-title">The conversation is already happening<span>.</span></h2>
        <p>Real people. Real disagreements. See what’s happening across Hot Take right now, then jump into the conversation.</p>
        <div className="landing-live-actions">
          <button type="button" onClick={onQuickMatch}><IconLightning />Find your match</button>
          <button type="button" onClick={onCustomRoom}>Create a room <span aria-hidden="true">↗</span></button>
        </div>
      </div>

      <div className="landing-live-board" aria-live="polite">
        <header>
          <span><i aria-hidden="true" />Platform activity</span>
          <small>{unavailable ? 'Reconnecting…' : stats ? 'Updates every 30 seconds' : 'Connecting…'}</small>
        </header>
        <div className="landing-live-stats">
          {cards.map((card) => (
            <article key={card.key} className={`landing-live-stat landing-live-stat--${card.tone}`}>
              <span className="landing-live-stat-icon" aria-hidden="true"><i /><i /><i /></span>
              <strong>{stats ? stats[card.key].toLocaleString() : '—'}</strong>
              <h3>{card.label}</h3>
              <p>{unavailable ? 'Live count temporarily unavailable' : card.detail}</p>
            </article>
          ))}
        </div>
        <footer><span aria-hidden="true">●</span> Counts are live platform data—not estimates.</footer>
      </div>
    </section>
  );
}

function HotTakeOfTheDay({ isSignedIn, onSignIn, onOpenProfile }) {
  const [take, setTake] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [comment, setComment] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);

  const load = async () => {
    try {
      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch('/api/daily-take', { cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error('Today’s take is unavailable.');
      setTake(await response.json());
    } catch (error) { setMessage(error.message); }
  };

  useEffect(() => { void load(); }, [isSignedIn]);

  const vote = async (side) => {
    if (!isSignedIn) { onSignIn(); return; }
    setBusy(true); setMessage('');
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/daily-take/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ side }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Your vote could not be saved.');
      setTake((current) => ({ ...current, ...body }));
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };

  const postComment = async (event) => {
    event.preventDefault();
    if (!isSignedIn) { onSignIn(); return; }
    if (!take.viewerVote) { setMessage('Vote before joining the comments.'); return; }
    const text = comment.trim();
    if (!text) return;
    setCommentBusy(true); setMessage('');
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/daily-take/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Your comment could not be posted.');
      setTake((current) => ({ ...current, comments: [body.comment, ...(current.comments || [])] }));
      setComment('');
    } catch (error) { setMessage(error.message); }
    finally { setCommentBusy(false); }
  };

  const openCommenterProfile = (uid) => {
    if (!isSignedIn) { onSignIn(); return; }
    if (uid) onOpenProfile(uid);
  };

  if (!take) return message ? null : <section className="landing-daily-take landing-daily-take--loading" aria-label="Loading Hot Take of the Day" />;
  const total = take.agreeVotes + take.disagreeVotes;
  const agreePercent = total ? Math.round(take.agreeVotes / total * 100) : 50;
  const disagreePercent = total ? 100 - agreePercent : 50;
  const comments = take.comments || [];

  return (
    <section className="landing-daily-take" aria-labelledby="daily-take-title">
      <div className="landing-daily-heading">
        <p><span>24H</span>Hot Take of the Day</p>
        <h2 id="daily-take-title">Pick a side<span>.</span></h2>
        <small>Vote once, change your mind anytime, and discuss the result below.</small>
      </div>
      <div className="landing-daily-arena">
        <div className="landing-daily-statement"><span>Today’s statement</span><blockquote>{take.statement}</blockquote><small>{total.toLocaleString()} verified vote{total === 1 ? '' : 's'}</small></div>
        <div className="landing-daily-votes">
          <button className={`landing-daily-side landing-daily-side--agree${take.viewerVote === 'agree' ? ' selected' : ''}`} disabled={busy} onClick={() => vote('agree')}>
            <span>Agree</span><strong>{take.viewerVote ? `${agreePercent}%` : 'Vote'}</strong><small>{take.agreeVotes.toLocaleString()} vote{take.agreeVotes === 1 ? '' : 's'}</small>
          </button>
          <div className="landing-daily-vs"><span>VS</span></div>
          <button className={`landing-daily-side landing-daily-side--disagree${take.viewerVote === 'disagree' ? ' selected' : ''}`} disabled={busy} onClick={() => vote('disagree')}>
            <span>Disagree</span><strong>{take.viewerVote ? `${disagreePercent}%` : 'Vote'}</strong><small>{take.disagreeVotes.toLocaleString()} vote{take.disagreeVotes === 1 ? '' : 's'}</small>
          </button>
          <div className="landing-daily-result" style={{ '--agree-share': `${agreePercent}%` }} aria-label={`${agreePercent}% agree and ${disagreePercent}% disagree`}><i /><i /></div>
        </div>
        {message && <p className="landing-daily-message">{message}</p>}
        <footer>
          <p>{take.viewerVote ? <>You voted <strong>{take.viewerVote}</strong>. You can change your vote anytime.</> : 'Sign in and cast your vote to see the live result and join the comments.'}</p>
        </footer>
      </div>
      <div className="landing-daily-comments">
        <div className="landing-daily-comments-heading">
          <div><span>Daily discussion</span><h3>Community comments</h3></div>
          <strong>{comments.length}</strong>
        </div>
        <form onSubmit={postComment}>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength="1000" rows="3" placeholder={take.viewerVote ? 'Share why you picked your side…' : 'Vote first to join the discussion…'} disabled={commentBusy || (isSignedIn && !take.viewerVote)} />
          <div><small>{comment.length}/1000</small><button type="submit" disabled={commentBusy || (isSignedIn && !take.viewerVote) || !comment.trim()}>{isSignedIn ? (commentBusy ? 'Posting…' : 'Post comment') : 'Sign in to comment'}</button></div>
        </form>
        <div className="landing-daily-comments-list">
          {comments.length === 0 && <p className="landing-daily-comments-empty">No comments yet. Cast your vote and start the conversation.</p>}
          {comments.map((entry) => (
            <article key={entry.id}>
              <button type="button" className="landing-daily-comment-profile landing-daily-comment-profile--avatar" onClick={() => openCommenterProfile(entry.uid)} aria-label={`View ${entry.displayName}'s profile`}>
                {entry.avatarUrl ? <img src={entry.avatarUrl} alt="" /> : <span className="landing-daily-comment-avatar" aria-hidden="true">{entry.displayName?.charAt(0)?.toUpperCase() || '?'}</span>}
              </button>
              <div><header><button type="button" className="landing-daily-comment-profile landing-daily-comment-profile--name" onClick={() => openCommenterProfile(entry.uid)}>{entry.displayName}</button><span className={`landing-daily-comment-side landing-daily-comment-side--${entry.side}`}>{entry.side}</span><time>{entry.createdAtMs ? new Date(entry.createdAtMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Just now'}</time></header><p>{entry.text}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
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
  onPickHelp,
  onPickWhatsHot,
  onPickFollowing,
  onProfile,
  onOpenProfile,
  brandExtras,
}) {
  const heroRef = useRef(null);
  const howSectionRef = useRef(null);
  const [howSectionVisible, setHowSectionVisible] = useState(false);

  const handleQuick = () => {
    if (!isSignedIn) onSignIn();
    else onQuickMatch();
  };

  const handleCustom = () => {
    if (!isSignedIn) onSignIn();
    else onCustomRoom();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('quickMatch') !== '1') return;
    window.history.replaceState({}, document.title, window.location.pathname);
    handleQuick();
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    let frame = 0;
    const updatePointer = (event) => {
      const bounds = hero.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width) * 100;
      const y = ((event.clientY - bounds.top) / bounds.height) * 100;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        hero.style.setProperty('--pointer-x', `${Math.max(0, Math.min(100, x))}%`);
        hero.style.setProperty('--pointer-y', `${Math.max(0, Math.min(100, y))}%`);
      });
    };
    const resetPointer = () => {
      hero.style.setProperty('--pointer-x', '50%');
      hero.style.setProperty('--pointer-y', '48%');
    };
    const updateScrollDepth = () => {
      const bounds = hero.getBoundingClientRect();
      const depth = Math.max(-1, Math.min(1, -bounds.top / Math.max(bounds.height, 1)));
      hero.style.setProperty('--hero-depth', depth.toFixed(3));
    };

    hero.addEventListener('pointermove', updatePointer, { passive: true });
    hero.addEventListener('pointerleave', resetPointer);
    window.addEventListener('scroll', updateScrollDepth, { passive: true });
    updateScrollDepth();
    return () => {
      cancelAnimationFrame(frame);
      hero.removeEventListener('pointermove', updatePointer);
      hero.removeEventListener('pointerleave', resetPointer);
      window.removeEventListener('scroll', updateScrollDepth);
    };
  }, []);

  useEffect(() => {
    const section = howSectionRef.current;
    if (!section || typeof IntersectionObserver === 'undefined') {
      setHowSectionVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setHowSectionVisible(true);
      observer.disconnect();
    }, { threshold: 0.18 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing">
      <SiteHeader
        onHome={() => {}}
        onAbout={onPickMission}
        onTopics={handleQuick}
        onWhatsHot={onPickWhatsHot}
        onFollowing={onPickFollowing}
        onFaq={onPickSupport}
        onSupport={onPickHelp}
        isSignedIn={isSignedIn}
        onSignIn={onSignIn}
        onSignUp={onSignUp}
        onSignOut={onSignOut}
        onProfile={onProfile}
        onPickLegal={onPickLegal}
        brandExtras={brandExtras}
      />

      <section ref={heroRef} className="landing-hero landing-hero--versus">
        <div className="landing-hero-atmosphere" aria-hidden="true">
          <span className="landing-smoke landing-smoke--one" />
          <span className="landing-smoke landing-smoke--two" />
          <span className="landing-pointer-light" />
          <div className="landing-embers">
            {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
          </div>
          <div className="landing-silver-specks">
            {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
          </div>
        </div>
        <div className="landing-hero-copy">
          <h1 className="landing-headline">
            Your opinion
            <br />
            <span className="landing-headline-accent">vs. the world.</span>
          </h1>
          <p className="landing-subhead">
            Pick a side. Get matched instantly.
            <br />
            Defend your take face-to-face.
          </p>
          <div className="landing-hero-actions" aria-label="Start debating">
            <button type="button" className="landing-btn landing-btn--primary landing-hero-btn" onClick={handleQuick}>
              <IconLightning />
              Quick Match
            </button>
            <button type="button" className="landing-btn landing-btn--outline landing-hero-btn" onClick={handleCustom}>
              <span className="landing-hero-plus" aria-hidden="true">+</span>
              Create a debate room
            </button>
          </div>
          <div className="landing-live-proof" aria-label="Live debates are happening now">
            <div className="landing-live-avatars" aria-hidden="true">
              <img src="/community-avatars.png" alt="" />
            </div>
            <span className="landing-live-dot" aria-hidden="true" />
            <p>Real people are debating right now</p>
            <span className="landing-live-pill">Live</span>
          </div>
        </div>
      </section>

      <section ref={howSectionRef} id="how-it-works" className={`landing-how${howSectionVisible ? ' is-visible' : ''}`}>
        <h2 className="landing-how-title">How it works</h2>
        <div className="landing-steps">
          <article className="landing-step"><StepIconMatch step="1" /><h3>Get matched</h3><p>We pair you with someone who disagrees with you.</p></article>
          <article className="landing-step"><StepIconDebate step="2" /><h3>Debate live</h3><p>Hop on a 1-on-1 video call and make your case.</p></article>
          <article className="landing-step"><StepIconChat step="3" /><h3>Keep talking</h3><p>Continue the conversation or debate someone new.</p></article>
        </div>
      </section>

      {SHOW_HOME_QUOTES && <QuoteCarousel />}

      <HotTakeOfTheDay isSignedIn={isSignedIn} onSignIn={onSignIn} onOpenProfile={onOpenProfile} />

      <LiveOnHotTake onQuickMatch={handleQuick} onCustomRoom={handleCustom} />

      <div id="topics" className="landing-anchor" aria-hidden="true" />
      <div id="faq" className="landing-anchor" aria-hidden="true" />

      <footer className="landing-footer">
        <div className="landing-footer-brand"><HotTakeWordmark variant="footer" /><p>Hot Take is a live debate platform for real conversations and different perspectives.</p></div>
        <div className="landing-footer-col"><h3>Company</h3><ul>
          <li><button type="button" onClick={onPickMission}>About</button></li>
          <li><button type="button" onClick={() => scrollToId('how-it-works')}>How it works</button></li>
          <li><button type="button" onClick={onPickSupport}>FAQ</button></li>
          <li><button type="button" onClick={onPickHelp}>Support</button></li>
        </ul></div>
        <div className="landing-footer-col"><h3>Policy agreements</h3><ul>
          <li><button type="button" onClick={() => onPickLegal('recording')}>Recording &amp; streaming consent</button></li>
          <li><button type="button" onClick={() => onPickLegal('community')}>Community guidelines</button></li>
          <li><button type="button" onClick={() => onPickLegal('privacy')}>Privacy policy</button></li>
          <li><button type="button" onClick={() => onPickLegal('terms')}>Terms of service</button></li>
        </ul></div>
        <div className="landing-footer-col landing-footer-social"><h3>Follow us</h3><div className="landing-social-row">
          <a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="X"><IconX /></a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IconInstagram /></a>
          <a href="https://reddit.com" target="_blank" rel="noopener noreferrer" aria-label="Reddit"><IconReddit /></a>
          <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><IconYouTube /></a>
        </div></div>
        <p className="landing-copyright">&copy; 2026 Hot Take Debate. All rights reserved.</p>
      </footer>
    </div>
  );
}

