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

const SCROLL_END_THRESHOLD_PX = 32;

function isScrolledToEnd(el) {
  if (!el) return false;
  const remaining = el.scrollHeight - el.clientHeight - el.scrollTop;
  return remaining <= SCROLL_END_THRESHOLD_PX;
}

export default function SignupLegalReview({ onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const scrollRef = useRef(null);

  const step = SIGNUP_LEGAL_STEPS[stepIndex];
  const DocComponent = step.Component;
  const isLast = stepIndex === SIGNUP_LEGAL_STEPS.length - 1;

  const updateScrollState = useCallback(() => {
    setScrolledToEnd(isScrolledToEnd(scrollRef.current));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    el.scrollTop = 0;
    setScrolledToEnd(isScrolledToEnd(el));

    const onScroll = () => updateScrollState();
    el.addEventListener('scroll', onScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => updateScrollState());
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
    };
  }, [stepIndex, updateScrollState]);

  const onContinue = () => {
    if (!scrolledToEnd) return;
    if (isLast) {
      onComplete();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  return (
    <section className="signup-legal-review" aria-labelledby="signup-legal-heading">
      <header className="signup-legal-review__header">
        <p className="signup-legal-review__step" aria-live="polite">
          Document {stepIndex + 1} of {SIGNUP_LEGAL_STEPS.length}
        </p>
        <h3 id="signup-legal-heading" className="signup-legal-review__title">
          {step.label}
        </h3>
        <p className="signup-legal-review__hint">
          Read the full document below. You must scroll to the end before you can continue.
        </p>
      </header>

      <div
        ref={scrollRef}
        className="signup-legal-review__scroll"
        tabIndex={0}
        role="region"
        aria-label={step.label}
      >
        <DocComponent embedded />
      </div>

      <footer className="signup-legal-review__footer">
        {!scrolledToEnd && (
          <p className="signup-legal-review__scroll-hint" role="status">
            Scroll down to read the rest of this document.
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary signup-legal-review__continue"
          disabled={!scrolledToEnd}
          onClick={onContinue}
        >
          {isLast ? 'Continue to account setup' : 'Continue to next document'}
        </button>
      </footer>
    </section>
  );
}
