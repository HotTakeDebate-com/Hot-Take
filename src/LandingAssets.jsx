/** SVG assets for the landing page mockup */

const RED = '#FF1E1E';
const WHITE = '#FFFFFF';
const GREY = '#A0A0A0';

/** Shared speech-bubble icon (matches brand mark). */
function LogoIcon() {
  return (
    <g aria-hidden="true">
      <path
        d="M2 3C2 1.34 3.34 0 5 0H29C30.66 0 32 1.34 32 3V19C32 20.66 30.66 22 29 22H17L11 28V22H5C3.34 22 2 20.66 2 19V3Z"
        fill={RED}
      />
      <path
        d="M14 1C14 0.45 14.45 0 15 0H39C40.55 0 42 1.45 42 3V19C42 20.55 40.55 22 39 22H27L21 28V22H15C13.45 22 12 20.55 12 19V3C12 1.45 13.45 0 15 0Z"
        fill={WHITE}
      />
      <circle cx="12" cy="11" r="1.6" fill="#000" />
      <circle cx="17" cy="11" r="1.6" fill="#000" />
      <circle cx="22" cy="11" r="1.6" fill="#000" />
      <circle cx="27" cy="11" r="1.6" fill="#000" />
      <circle cx="32" cy="11" r="1.6" fill="#000" />
    </g>
  );
}

export function HotTakeWordmark({ variant = 'nav' }) {
  if (variant === 'nav') {
    return (
      <svg
        className="landing-logo-svg landing-logo-svg--nav"
        viewBox="0 0 260 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Hot Take — Discuss. Debate. Diverge."
      >
        <g transform="translate(0, 6) scale(0.95)">
          <LogoIcon />
        </g>
        <text
          x="48"
          y="22"
          fill={RED}
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="18"
          fontWeight="700"
        >
          hot
        </text>
        <text
          x="82"
          y="22"
          fill={WHITE}
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="18"
          fontWeight="700"
        >
          take
        </text>
        <text
          x="48"
          y="36"
          fill={GREY}
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="6.5"
          fontWeight="500"
          letterSpacing="1.8"
        >
          DISCUSS. DEBATE. DIVERGE.
        </text>
      </svg>
    );
  }

  return (
    <svg
      className="landing-logo-svg landing-logo-svg--footer"
      viewBox="0 0 140 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Hot Take — Discuss. Debate. Diverge."
    >
      <g transform="translate(38, 0) scale(1.5)">
        <LogoIcon />
      </g>
      <text
        x="70"
        y="78"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="16"
        fontWeight="700"
      >
        <tspan fill={RED}>hot</tspan>
        <tspan fill={WHITE}>take</tspan>
      </text>
      <text
        x="70"
        y="96"
        textAnchor="middle"
        fill={GREY}
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="5.5"
        fontWeight="500"
        letterSpacing="1.4"
      >
        DISCUSS. DEBATE. DIVERGE.
      </text>
    </svg>
  );
}

export function HeroBubblesVisual() {
  return (
    <svg
      className="landing-hero-logo"
      viewBox="0 0 280 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g transform="translate(70, 0) scale(3.2)">
        <LogoIcon />
      </g>
      <text
        x="140"
        y="148"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="28"
        fontWeight="700"
      >
        <tspan fill={RED}>hot</tspan>
        <tspan fill={WHITE}>take</tspan>
      </text>
      <text
        x="140"
        y="178"
        textAnchor="middle"
        fill={GREY}
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="9"
        fontWeight="500"
        letterSpacing="2.8"
      >
        DISCUSS. DEBATE. DIVERGE.
      </text>
    </svg>
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="10" cy="8" r="4" />
      <path d="M4 20c0-3.5 2.7-6.5 6-7" strokeLinecap="round" />
      <path d="M18 8v6M15 11h6" strokeLinecap="round" />
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

export function IconTikTok() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
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
