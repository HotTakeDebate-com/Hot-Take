/** SVG assets for the landing page mockup */

const RED = '#FF1E1E';
const WHITE = '#FFFFFF';

export function HotTakeWordmark({ variant = 'nav' }) {
  if (variant === 'nav') {
    return (
      <img
        src="/hottake-logo-horizontal.png"
        alt="Hot Take ? Discuss. Debate. Diverge."
        className="landing-logo-img landing-logo-img--nav"
        draggable={false}
      />
    );
  }

  return (
    <img
      src="/hottake-logo-horizontal.png"
      alt="Hot Take ? Discuss. Debate. Diverge."
      className="landing-logo-img landing-logo-img--footer"
      draggable={false}
    />
  );
}

export function HeroBubblesVisual() {
  return (
    <img
      src="/hero-debate-artwork.png"
      alt=""
      aria-hidden="true"
      className="landing-hero-reference"
      draggable={false}
    />
  );
}

export function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
    </svg>
  );
}

export function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3L4 7v5c0 5 3.5 9 8 10 4.5-1 8-5 8-10V7l-8-4z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconVideo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l6-3v10l-6-3" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLightning() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={RED} aria-hidden="true">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}

export function IconUserPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21v-2a7 7 0 0 1 14 0v2" />
      <path d="M19 8v6" />
      <path d="M16 11h6" />
    </svg>
  );
}

export function StepIconMatch({ step }) {
  return (
    <div className="landing-step-icon-wrap">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="23" stroke="#333" strokeWidth="1.5" />
        <circle cx="24" cy="18" r="6" stroke={WHITE} strokeWidth="2" />
        <path d="M12 38c0-6 5.4-11 12-11s12 5 12 11" stroke={WHITE} strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="landing-step-badge">{step}</span>
    </div>
  );
}

export function StepIconDebate({ step }) {
  return (
    <div className="landing-step-icon-wrap">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="23" stroke="#333" strokeWidth="1.5" />
        <rect x="12" y="16" width="16" height="12" rx="2" stroke={WHITE} strokeWidth="2" />
        <path d="M28 20l8-4v12l-8-4" stroke={WHITE} strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <span className="landing-step-badge">{step}</span>
    </div>
  );
}

export function StepIconChat({ step }) {
  return (
    <div className="landing-step-icon-wrap">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="23" stroke="#333" strokeWidth="1.5" />
        <path
          d="M14 16h20a2 2 0 012 2v10a2 2 0 01-2 2H22l-6 6v-6h-2a2 2 0 01-2-2V18a2 2 0 012-2z"
          stroke={WHITE}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      <span className="landing-step-badge">{step}</span>
    </div>
  );
}

export function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function IconInstagram() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconReddit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="7.2" />
      <circle cx="8.8" cy="12.3" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.2" cy="12.3" r="1" fill="currentColor" stroke="none" />
      <path d="M8.7 15.4c1.8 1.2 4.8 1.2 6.6 0M11.2 5.9l1-3.2 4.1.9" />
      <circle cx="18.2" cy="4" r="1.8" />
      <path d="M5.2 10.2C2.7 8.3 1 10.1 2.2 12M18.8 10.2c2.5-1.9 4.2-.1 3 1.8" />
    </svg>
  );
}

export function IconYouTube() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.5a3 3 0 00-2.1-2.1C19.5 4 12 4 12 4s-7.5 0-9.4.4A3 3 0 00.5 6.5 31 31 0 000 12a31 31 0 00.5 5.5 3 3 0 002.1 2.1C4.5 20 12 20 12 20s7.5 0 9.4-.4a3 3 0 002.1-2.1A31 31 0 0024 12a31 31 0 00-.5-5.5zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
    </svg>
  );
}

export { RED };
