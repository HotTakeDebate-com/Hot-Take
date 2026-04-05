import { useCallback, useEffect, useState } from 'react';
import { reload, sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from './firebase.js';
import BrandLogo from './BrandLogo.jsx';
import './AuthScreen.css';

const RESEND_COOLDOWN_SEC = 60;

function mapAuthError(code) {
  switch (code) {
    case 'auth/too-many-requests':
      return 'Too many emails sent. Wait a few minutes, then try Resend again.';
    default:
      return 'Could not send email. Try again in a moment.';
  }
}

export default function VerifyEmailScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const u = auth?.currentUser;
    setEmail(u?.email ?? '');
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendVerification = useCallback(async () => {
    const user = auth?.currentUser;
    if (!user) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await sendEmailVerification(user);
      setInfo(`We sent another link to ${user.email ?? 'your email'}.`);
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(mapAuthError(err?.code));
    } finally {
      setBusy(false);
    }
  }, []);

  const onVerifiedClicked = async () => {
    const user = auth?.currentUser;
    if (!user) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await reload(user);
      await user.getIdToken(true);
      if (!auth.currentUser?.emailVerified) {
        setError('Still not verified. Open the link in the email we sent, then try again.');
      }
    } catch (err) {
      setError(err?.message ?? 'Could not refresh your account. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    setBusy(true);
    try {
      if (auth) await signOut(auth);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-screen-inner">
        <div className="auth-screen-card">
          <div className="auth-screen-logo-wrap">
            <BrandLogo />
          </div>
          <h2 className="auth-screen-title">Verify your email</h2>
          <p className="auth-screen-lead">
            Your account is created. We sent a message to <strong>{email || 'your inbox'}</strong>. Open the
            link in that email to confirm it&apos;s really you, then tap continue below.
          </p>

          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          {info && (
            <p className="auth-success" role="status">
              {info}
            </p>
          )}

          <div className="auth-form" style={{ gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary auth-submit"
              onClick={onVerifiedClicked}
              disabled={busy}
            >
              {busy ? 'Checking…' : "I've verified — continue"}
            </button>
            <button
              type="button"
              className="btn btn-ghost auth-submit"
              onClick={sendVerification}
              disabled={busy || cooldown > 0}
            >
              {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend verification email'}
            </button>
            <button type="button" className="auth-linkish" onClick={onSignOut} disabled={busy}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
