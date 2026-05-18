import { useCallback, useEffect, useRef, useState } from 'react';
import CommunityGuidelines from './legal/CommunityGuidelines.jsx';
import PrivacyPolicy from './legal/PrivacyPolicy.jsx';
import RecordingAgreement from './legal/RecordingAgreement.jsx';
import TermsOfService from './legal/TermsOfService.jsx';

const SIGNUP_LEGAL_STEPS = [
  { id: 'terms', label: 'Terms of Service', Component: TermsOfService },
  { id: 'privacy', label: 'Privacy Policy', Component: PrivacyPolicy },
  { id: 'community', label: 'Community Guidelines', Component: CommunityGuidelines },
  { id: 'recording', label: 'Recording Agreement', Component: RecordingAgreement },
];

const SCROLL_END_THRESHOLD_PX = 48;
const MIN_SCROLL_DEPTH_PX = 120;
/** Short docs that fit without scrolling must stay on screen at least this long. */
const MIN_READ_SECONDS_SHORT_DOC = 8;

function isScrolledToEnd(el) {
  if (!el) return false;
  const remaining = el.scrollHeight - el.clientHeight - el.scrollTop;
  return remaining <= SCROLL_END_THRESHOLD_PX;
}

function documentNeedsScrolling(el) {
  if (!el) return true;
  return el.scrollHeight - el.clientHeight > SCROLL_END_THRESHOLD_PX;
}

export default function SignupLegalReview({ onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [maxScrollTop, setMaxScrollTop] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const [dwellSec, setDwellSec] = useState(0);
  const [needsScroll, setNeedsScroll] = useState(true);
  const scrollRef = useRef(null);
  const stepStartedAt = useRef(Date.now());

  const step = SIGNUP_LEGAL_STEPS[stepIndex];
  const DocComponent = step.Component;
  const isLast = stepIndex === SIGNUP_LEGAL_STEPS.length - 1;

  const updateScrollMetrics = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollable = documentNeedsScrolling(el);
    setNeedsScroll(scrollable);
    setMaxScrollTop((prev) => Math.max(prev, el.scrollTop));
    setAtEnd(isScrolledToEnd(el));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    el.scrollTop = 0;
    setMaxScrollTop(0);
    setAtEnd(false);
    setDwellSec(0);
    stepStartedAt.current = Date.now();

    const onScroll = () => updateScrollMetrics();
    el.addEventListener('scroll', onScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => updateScrollMetrics());
    });
    resizeObserver.observe(el);

    requestAnimationFrame(() => updateScrollMetrics());

    return () => {
      el.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
    };
  }, [stepIndex, updateScrollMetrics]);

  useEffect(() => {
    const tick = setInterval(() => {
      setDwellSec(Math.floor((Date.now() - stepStartedAt.current) / 1000));
    }, 500);
    return () => clearInterval(tick);
  }, [stepIndex]);

  const scrolledEnough = maxScrollTop >= MIN_SCROLL_DEPTH_PX;
  const shortDocReady = !needsScroll && dwellSec >= MIN_READ_SECONDS_SHORT_DOC;
  const longDocReady = needsScroll && scrolledEnough && atEnd;
  const canContinue = shortDocReady || longDocReady;

  const continueHint = (() => {
    if (canContinue) return null;
    if (!needsScroll) {
      const left = Math.max(0, MIN_READ_SECONDS_SHORT_DOC - dwellSec);
      return `Please read this document (${left}s remaining).`;
    }
    if (!scrolledEnough) {
      return 'Scroll down through the document to continue.';
    }
    return 'Scroll to the very end of this document to continue.';
  })();

  const onContinue = () => {
    if (!canContinue) return;
    if (isLast) {
      onComplete();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  return (
    <section className="signup-legal-review" aria-labelledby="signup-legal-heading">
      <div className="signup-legal-review__progress" aria-hidden>
        {SIGNUP_LEGAL_STEPS.map((s, i) => (
          <span
            key={s.id}
            className={[
              'signup-legal-review__progress-dot',
              i < stepIndex && 'signup-legal-review__progress-dot--done',
              i === stepIndex && 'signup-legal-review__progress-dot--active',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>

      <header className="signup-legal-review__header">
        <p className="signup-legal-review__step" aria-live="polite">
          Required reading — document {stepIndex + 1} of {SIGNUP_LEGAL_STEPS.length}
        </p>
        <h3 id="signup-legal-heading" className="signup-legal-review__title">
          {step.label}
        </h3>
        <p className="signup-legal-review__hint">
          You must read each policy in full before creating an account. Scroll through the entire
          document below{needsScroll ? '' : ' and wait for the timer'}.
        </p>
      </header>

      <p className="signup-legal-review__scroll-label">Document text</p>
      <div
        ref={scrollRef}
        className="signup-legal-review__scroll"
        tabIndex={0}
        role="region"
        aria-label={`${step.label} — scroll to read`}
      >
        <DocComponent embedded />
      </div>

      <footer className="signup-legal-review__footer">
        {continueHint && (
          <p className="signup-legal-review__scroll-hint" role="status">
            {continueHint}
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary signup-legal-review__continue"
          disabled={!canContinue}
          onClick={onContinue}
        >
          {isLast ? 'I have read all policies — continue' : 'Next document'}
        </button>
      </footer>
    </section>
  );
}
