import { useCallback, useEffect, useMemo, useState } from 'react';
import GenericAvatar from './GenericAvatar.jsx';
import IdentityBadges from './IdentityBadges.jsx';
import { networkFollowing } from './networkApi.js';
import { SiteFooter, SiteHeader } from './SiteChrome.jsx';
import './FollowingPage.css';
import './FollowingLayoutFix.css';

const ACTIVITY_ORDER = { hosting_room: 0, debating: 1, quick_match: 2, joining_room: 3, online: 4, offline: 5 };

export default function FollowingPage({ onHome, onAbout, onQuickMatch, onWhatsHot, onFaq, onSupport, onProfile, onSignOut, onPickLegal, onOpenProfile, brandExtras }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await networkFollowing();
      setMembers(Array.isArray(result.members) ? result.members : []);
      setError('');
    } catch (loadError) {
      setError(loadError?.message || 'Could not load the accounts you follow.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load({ quiet: true }), 15000);
    const socket = window.__hotTakeNetworkSocket;
    const refresh = () => load({ quiet: true });
    ['connect', 'disconnect', 'member-activity-updated', 'custom-games', 'match-found'].forEach((event) => socket?.on?.(event, refresh));
    return () => {
      window.clearInterval(timer);
      ['connect', 'disconnect', 'member-activity-updated', 'custom-games', 'match-found'].forEach((event) => socket?.off?.(event, refresh));
    };
  }, [load]);

  const sortedMembers = useMemo(() => [...members].sort((a, b) => {
    const activityDifference = (ACTIVITY_ORDER[a.activity?.key] ?? 9) - (ACTIVITY_ORDER[b.activity?.key] ?? 9);
    return activityDifference || String(a.displayName || '').localeCompare(String(b.displayName || ''));
  }), [members]);
  const activeCount = members.filter((member) => member.activity?.key && member.activity.key !== 'offline').length;

  return <div className="following-page">
    <SiteHeader onHome={onHome} onAbout={onAbout} onTopics={onQuickMatch} onWhatsHot={onWhatsHot} onFollowing={() => {}} onFaq={onFaq} onSupport={onSupport} isSignedIn onSignOut={onSignOut} onProfile={onProfile} onPickLegal={onPickLegal} brandExtras={brandExtras} />
    <main className="following-shell">
      <header className="following-heading">
        <div><p>YOUR NETWORK</p><h1>Following<span>.</span></h1><small>See what the debaters you follow are doing right now.</small></div>
        <button type="button" onClick={() => load({ quiet: true })} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh activity'}</button>
      </header>
      <section className="following-summary" aria-label="Following summary">
        <div><strong>{members.length}</strong><span>Following</span></div>
        <div><strong>{activeCount}</strong><span>Active now</span></div>
        <p><i />Activity refreshes automatically</p>
      </section>

      {loading ? <section className="following-state"><span className="following-spinner" /><h2>Loading your network…</h2></section>
        : error ? <section className="following-state following-state--error"><h2>We couldn’t load Following.</h2><p>{error}</p><button type="button" onClick={() => load()}>Try again</button></section>
        : !sortedMembers.length ? <section className="following-state"><h2>Your following list is waiting.</h2><p>Search for a debater, open their profile, and follow them to see their live activity here.</p></section>
        : <section className="following-grid" aria-label="Accounts you follow">
          {sortedMembers.map((member) => {
            const activityKey = member.activity?.key || 'offline';
            return <article className={`following-member following-member--${activityKey}`} key={member.uid}>
              <button type="button" className="following-member-main" onClick={() => onOpenProfile?.(member.uid)}>
                <span className={`following-avatar${member.avatarUrl ? ' has-image' : ''}`}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <GenericAvatar />}</span>
                <span className="following-identity"><strong>{member.displayName || 'Hot Take member'} <IdentityBadges compact premium={member.premium} verified={member.verifiedDebater} role={member.role} /></strong><small>View profile <b>→</b></small></span>
              </button>
              <div className="following-activity"><span><i />{activityKey === 'offline' ? 'Offline' : 'Live activity'}</span><strong>{member.activity?.label || 'Offline'}</strong></div>
            </article>;
          })}
        </section>}
    </main>
    <SiteFooter onHome={onHome} onAbout={onAbout} onFaq={onFaq} onSupport={onSupport} onPickLegal={onPickLegal} />
  </div>;
}

