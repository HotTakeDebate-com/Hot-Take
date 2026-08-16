import { HotTakeWordmark, IconInstagram, IconReddit, IconX, IconYouTube } from './LandingAssets.jsx';
import HeaderNavMenu from './HeaderNavMenu.jsx';

export function SiteHeader({ onHome, onAbout, onTopics, onWhatsHot, brandExtras, onFaq, onSupport, isSignedIn, onSignIn, onSignUp, onSignOut, onProfile, onPickLegal }) {
  const globalAdminAction = typeof window !== 'undefined' ? window.__hotTakeAdminAction : null;
  const adminControl = brandExtras || (globalAdminAction ? (
    <button type="button" className="landing-admin-link" onClick={globalAdminAction}>Admin</button>
  ) : null);
  return <header className="landing-nav">
    <div className="landing-nav-brand-group">
      <button type="button" className="landing-nav-brand site-brand-button" onClick={onHome}><HotTakeWordmark variant="nav" /></button>
      {adminControl}
    </div>
    <nav className="landing-nav-links" aria-label="Primary">
      <button type="button" className="landing-nav-link" onClick={onAbout}>About</button>
      <button type="button" className="landing-nav-link" onClick={onTopics}>Quick match</button>
      <button type="button" className="landing-nav-link landing-nav-link--hot" onClick={onWhatsHot || onHome}>What&apos;s Hot</button>
      <button type="button" className="landing-nav-link" onClick={onFaq}>FAQ</button>
      <button type="button" className="landing-nav-link" onClick={onSupport}>Support</button>
    </nav>
    <div className="landing-nav-actions">
      {isSignedIn ? <>
        <button type="button" className="landing-btn landing-btn--ghost" onClick={onProfile}>Account</button>
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
      <li><button type="button" onClick={onSupport}>Support</button></li>
    </ul></div>
    <div className="landing-footer-col"><h3>Policy agreements</h3><ul>
      <li><button type="button" onClick={() => onPickLegal?.('recording')}>Recording &amp; streaming consent</button></li>
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
