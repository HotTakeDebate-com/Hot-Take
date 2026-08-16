import { useEffect, useState } from 'react';
import { networkApplyForVerification, networkMe } from './networkApi.js';
import { SiteFooter, SiteHeader } from './SiteChrome.jsx';
import IdentityBadges from './IdentityBadges.jsx';
import './DebateNetwork.css';

export default function VerificationApplicationPage({ onHome, onAbout, onQuickMatch, onWhatsHot, onFaq, onSupport, onProfile, onSignOut, onPickLegal, onBack }) {
  const [state, setState] = useState({ identity: null, application: null });
  const [form, setForm] = useState({ platform: '', profileUrl: '', followerCount: '', supportingLinks: '', explanation: '', controlsAccount: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => { networkMe().then(setState).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      const result = await networkApplyForVerification({ ...form, supportingLinks: form.supportingLinks.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) });
      setState((current) => ({ ...current, application: { ...form, status: result.status } }));
      setSuccess('Your verification application has been submitted for review.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };
  const active = state.application && ['pending', 'info_requested', 'approved', 'denied', 'revoked'].includes(state.application.status);
  return <div className="verification-page">
    <SiteHeader onHome={onHome} onAbout={onAbout} onTopics={onQuickMatch} onWhatsHot={onWhatsHot} onFaq={onFaq} onSupport={onSupport} isSignedIn onSignOut={onSignOut} onProfile={onProfile} onPickLegal={onPickLegal} />
    <main className="verification-shell">
      <button type="button" className="verification-back" onClick={onBack}>← Back</button>
      <header className="verification-hero"><div><p>DEBATER VERIFICATION</p><h1>Stand out for the arguments you bring.</h1><span>Verified status identifies established debaters and public voices. It does not endorse a person&apos;s opinions.</span></div><IdentityBadges verified /></header>
      {loading ? <div className="verification-card">Loading your verification status…</div> : state.identity?.verifiedDebater ? <section className="verification-card verification-result"><IdentityBadges verified /><h2>You&apos;re a verified debater</h2><p>Your green verification check appears wherever people discover or debate with you.</p></section> : active && state.application.status !== 'denied' && state.application.status !== 'revoked' ? <section className="verification-card verification-result"><span className={`verification-status status-${state.application.status}`}>{String(state.application.status).replace('_', ' ')}</span><h2>Application {state.application.status === 'pending' ? 'under review' : 'needs more information'}</h2><p>The administration team will review the public profile and evidence you submitted.</p></section> : <form className="verification-form" onSubmit={submit}>
        <section className="verification-card"><h2>Your public presence</h2><div className="verification-grid"><label>Primary platform<input value={form.platform} onChange={(e) => update('platform', e.target.value)} placeholder="YouTube, X, podcast, publication…" required /></label><label>Follower or subscriber count<input type="number" min="0" value={form.followerCount} onChange={(e) => update('followerCount', e.target.value)} placeholder="0" /></label></div><label>Public profile URL<input type="url" value={form.profileUrl} onChange={(e) => update('profileUrl', e.target.value)} placeholder="https://…" required /></label><label>Supporting links <small>One per line, up to five</small><textarea value={form.supportingLinks} onChange={(e) => update('supportingLinks', e.target.value)} placeholder="Interviews, event pages, articles, debate appearances…" /></label></section>
        <section className="verification-card"><h2>Why should this account be verified?</h2><label>Tell us about your public work<textarea minLength="20" value={form.explanation} onChange={(e) => update('explanation', e.target.value)} placeholder="Describe your audience, debate experience, public work, and how we can confirm your identity." required /></label><label className="verification-confirm"><input type="checkbox" checked={form.controlsAccount} onChange={(e) => update('controlsAccount', e.target.checked)} required /><span>I confirm that I control the linked account and that this application is accurate.</span></label></section>
        {error && <div className="verification-alert error">{error}</div>}{success && <div className="verification-alert success">{success}</div>}
        <button type="submit" className="verification-submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit verification application'}</button>
      </form>}
    </main>
    <SiteFooter onHome={onHome} onAbout={onAbout} onFaq={onFaq} onSupport={onSupport} onPickLegal={onPickLegal} />
  </div>;
}

