import { useCallback, useEffect, useId, useRef, useState } from 'react';

const LEGAL_ITEMS = [
  { id: 'terms', label: 'Terms of Service' },
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'community', label: 'Community Guidelines' },
  { id: 'recording', label: 'Recording & streaming consent' },
];

/**
 * Header “more” menu: legal docs, mission, support — easy to extend with more entries later.
 */
export default function HeaderNavMenu({
  onPickLegal,
  onPickMission,
  onPickFaq,
  onPickSupport,
  onPickSearch,
  onPickMessages,
  onPickNotifications,
  onPickWhatsHot,
  onPickFollowing,
  onPickAccount,
  onPickAdmin,
  onSignOut,
  variant = 'default',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const pickLegal = (id) => {
    onPickLegal(id);
    close();
  };
  const pickMission = () => {
    onPickMission();
    close();
  };
  const pickSupport = () => {
    onPickSupport();
    close();
  };
  const pickFaq = () => {
    onPickFaq?.();
    close();
  };
  const pickVerification = () => {
    window.__hotTakeOpenVerification?.();
    close();
  };
  const pick = (action) => {
    close();
    window.setTimeout(() => action?.(), 0);
  };

  const triggerClass =
    variant === 'landing'
      ? 'landing-btn landing-btn--ghost landing-nav-menu-trigger'
      : 'btn btn-ghost header-nav-trigger header-chip';

  return (
    <div className={`header-nav ${variant === 'landing' ? 'header-nav--landing' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {variant === 'landing' ? <>
          <span className="landing-menu-icon" aria-hidden="true"><i /><i /><i /></span>
          <span className="sr-only">Menu</span>
        </> : <>
          Menu
          <span className="header-nav-chevron" aria-hidden>{open ? '▴' : '▾'}</span>
        </>}
      </button>
      {open && (
        <div id={menuId} className="header-nav-panel" role="menu">
          {variant === 'landing' && <>
            <div className="header-nav-mobile-primary">
              <div className="header-nav-group-label" role="presentation">Navigate</div>
              <button type="button" className="header-nav-item" role="menuitem" onClick={() => pick(onPickSearch)}>Search members</button>
              <button type="button" className="header-nav-item" role="menuitem" onClick={() => pick(onPickMessages)}>Messages</button>
              <button type="button" className="header-nav-item" role="menuitem" onClick={() => pick(onPickNotifications)}>Notifications</button>
              <button type="button" className="header-nav-item header-nav-item--hot" role="menuitem" onClick={() => pick(onPickWhatsHot)}>What&apos;s Hot</button>
              <button type="button" className="header-nav-item" role="menuitem" onClick={() => pick(onPickFollowing)}>Following</button>
              <div className="header-nav-sep" role="separator" />
              <button type="button" className="header-nav-item" role="menuitem" onClick={() => pick(onPickAccount)}>Account</button>
              {onPickAdmin && <button type="button" className="header-nav-item" role="menuitem" onClick={() => pick(onPickAdmin)}>Admin panel</button>}
              <button type="button" className="header-nav-item header-nav-item--signout" role="menuitem" onClick={() => pick(onSignOut)}>Sign out</button>
              <div className="header-nav-sep" role="separator" />
            </div>
          </>}
          <div className="header-nav-group-label" role="presentation">
            Legal
          </div>
          {LEGAL_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="header-nav-item"
              role="menuitem"
              onClick={() => pickLegal(item.id)}
            >
              {item.label}
            </button>
          ))}
          <div className="header-nav-sep" role="separator" />
          <button type="button" className="header-nav-item" role="menuitem" onClick={pickMission}>
            Our Mission
          </button>
          <button type="button" className="header-nav-item" role="menuitem" onClick={pickFaq}>
            FAQ
          </button>
          <button type="button" className="header-nav-item" role="menuitem" onClick={pickSupport}>
            Support
          </button>
          {typeof window !== 'undefined' && window.__hotTakeOpenVerification && <button type="button" className="header-nav-item header-nav-item--verification" role="menuitem" onClick={pickVerification}>
            Apply for verified status
          </button>}
        </div>
      )}
    </div>
  );
}

