import { HotTakeWordmark, IconInstagram, IconReddit, IconX, IconYouTube } from './LandingAssets.jsx';
import HeaderNavMenu from './HeaderNavMenu.jsx';
import './SiteChrome.css';

export function SiteHeader({ onHome, onAbout, onTopics, onQuickMatch, onFaq, onSupport, isSignedIn, onSignIn, onSignUp, onSignOut, onProfile, onPickLegal }) {
  const goQuickMatch = () => {
    if (onQuickMatch) {
      onQuickMatch();
      return;
    }

    // Some secondary pages are rendered as overlays and do not currently pass
    // the Quick Match callback through. Do a clean, deterministic navigation
    // instead of clicking the hidden homepage CTA underneath the overlay.
    // HomePage consumes ?quickMatch=1 and immediately opens the Quick Match UI.
    window.location.assign('/?quickMatch=1');
  };

  return <header className="landing-nav">
    <button type="button" className="landing-nav-brand site-brand-button" onClick={onHome}><HotTakeWordmark variant="nav" /></button>
    <nav className="landing-nav-links" aria-label="Primary">
      <button type="button" className="landing-nav-link" onClick={onHome}>How it works</button>
      <button type="button" className="landing-nav-link" onClick={onAbout}>About</button>
      <button type="button" className="landing-nav-link" onClick={goQuickMatch}>Quick match</button>
      <button type="button" className="landing-nav-link" onClick={onFaq}>FAQ</button>
      <button type="button" className="landing-nav-link" onClick={onSupport}>Support</button>
    </nav>
    <div className="landing-nav-actions">
      {isSignedIn ? <>
        <button type="button" className="landing-btn landing-btn--ghost" onClick={onProfile}>Profile</button>
        <HeaderNavMenu variant="landing" onPickLegal={onPickLegal} onPickMission={onAbout} onPickSupport={onSupport} />
        <button type="button" className="landing-btn landing-btn--ghost" onClick={onSignOut}>Sign out</button>
      </> : <>
        <button type="button" className="landing-btn landing-btn--ghost" onClick={onSignIn}>Sign in</button>
        <button type="button" className="landing-btn landing-btn--primary" onClick={onSignUp}>Create account</button>
      </>}
    </div>
  </header>;
}

export function SiteFooter({ onHome, onAbout, onFaq, onSupport, onPickLegal }) {
  return <footer className="landing-footer site-shared-footer">
    <div className="landing-footer-brand"><HotTakeWordmark variant="footer" /><p>Hot Take is a live debate platform for real conversations and different perspectives.</p></div>
    <div className="landing-footer-col"><h3>Company</h3><ul>
      <li><button type="button" onClick={onAbout}>About</button></li>
      <li><button type="button" onClick={onHome}>How it works</button></li>
      <li><button type="button" onClick={onFaq}>FAQ</button></li>
      <li><button type="button" onClick={onSupport}>Contact</button></li>
    </ul></div>
    <div className="landing-footer-col"><h3>Support</h3><ul>
      <li><button type="button" onClick={onSupport}>Help center</button></li>
      <li><button type="button" onClick={() => onPickLegal?.('community')}>Community guidelines</button></li>
      <li><button type="button" onClick={() => onPickLegal?.('privacy')}>Privacy policy</button></li>
      <li><button type="button" onClick={() => onPickLegal?.('terms')}>Terms of service</button></li>
    </ul></div>
    <div className="landing-footer-col landing-footer-social"><h3>Follow us</h3><div className="landing-social-row">
      <a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="X"><IconX /></a>
      <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IconInstagram /></a>
      <a href="https://reddit.com" target="_blank" rel="noopener noreferrer" aria-label="Reddit"><IconReddit /></a>
      <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><IconYouTube /></a>
    </div></div>
    <p className="landing-copyright">&copy; 2026 Hot Take Debate. All rights reserved.</p>
  </footer>;
}
