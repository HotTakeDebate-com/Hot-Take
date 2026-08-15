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
        <p>Words on disagreement, truth, freedom, and moral courage.</p>
      </div>

      <div className="landing-quote-stage">
        <button className="landing-quote-arrow landing-quote-arrow--previous" type="button" onClick={() => show(index - 1)} aria-label="Previous quote">←</button>
        <article className={`landing-quote-card${isFading ? ' is-fading' : ''}`} aria-live="polite">
          <div className="landing-quote-category"><span aria-hidden="true">◆</span>{quote.category}</div>
          <blockquote>“{quote.quote}”</blockquote>
          <footer>
            <div>
              <strong>— {quote.author}</strong>
              <span>{quote.date}</span>
            </div>
            <span className="landing-quote-count">{String(index + 1).padStart(2, '0')} / {HOME_QUOTES.length}</span>
          </footer>
          {quote.source && <p className="landing-quote-source">Source: <cite>{quote.source}</cite></p>}
          {quote.note && <p className="landing-quote-note"><span aria-hidden="true">!</span>{quote.note}</p>}
        </article>
        <button className="landing-quote-arrow landing-quote-arrow--next" type="button" onClick={() => show(index + 1)} aria-label="Next quote">→</button>
      </div>

      <div className="landing-quote-controls">
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
  brandExtras,
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('quickMatch') !== '1') return;
    window.history.replaceState({}, document.title, window.location.pathname);
    handleQuick();
  }, []);

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-brand-group">
          <a href="/" className="landing-nav-brand" onClick={(e) => e.preventDefault()}>
            <HotTakeWordmark variant="nav" />
          </a>
          {brandExtras}
        </div>

        <nav className="landing-nav-links" aria-label="Primary">
          <button type="button" className="landing-nav-link" onClick={onPickMission}>About</button>
          <button type="button" className="landing-nav-link" onClick={handleQuick}>Quick match</button>
          <button type="button" className="landing-nav-link landing-nav-link--hot" onClick={onPickWhatsHot}>What&apos;s Hot</button>
          <button type="button" className="landing-nav-link" onClick={onPickSupport}>FAQ</button>
          <button type="button" className="landing-nav-link" onClick={onPickHelp}>Support</button>
        </nav>

        <div className="landing-nav-actions">
          {navExtras}
          {isSignedIn ? (
            <button type="button" className="landing-btn landing-btn--ghost" onClick={onSignOut}>Sign out</button>
          ) : (
            <>
              <button type="button" className="landing-btn landing-btn--ghost" onClick={onSignIn}>Sign in</button>
              <button type="button" className="landing-btn landing-btn--primary" onClick={onSignUp}>Create account</button>
            </>
          )}
        </div>
      </header>

      <section className="landing-hero landing-hero--versus">
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

      <section id="how-it-works" className="landing-how">
        <h2 className="landing-how-title">How it works</h2>
        <div className="landing-steps">
          <article className="landing-step"><StepIconMatch step="1" /><h3>Get matched</h3><p>We pair you with someone who disagrees with you.</p></article>
          <article className="landing-step"><StepIconDebate step="2" /><h3>Debate live</h3><p>Hop on a 1-on-1 video call and make your case.</p></article>
          <article className="landing-step"><StepIconChat step="3" /><h3>Keep talking</h3><p>Continue the conversation or debate someone new.</p></article>
        </div>
      </section>

      <QuoteCarousel />

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
