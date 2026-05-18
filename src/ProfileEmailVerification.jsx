import { useCallback, useEffect, useState } from 'react';
import { onIdTokenChanged, reload } from 'firebase/auth';
import { auth } from './firebase.js';
import { sendHotTakeEmailVerification } from './firebaseEmailVerification.js';

const RESEND_COOLDOWN_SEC = 60;

function mapAuthError(code) {
  switch (code) {
    case 'auth/too-many-requests':
      return 'Too many emails sent. Wait a few minutes, then try again.';
    default:
      return 'Could not send email. Try again in a moment.';
  }
}

export default function ProfileEmailVerification() {
  const [email, setEmail] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!auth) return undefined;
    const sync = (user) => {
      setEmail(user?.email ?? '');
      setVerified(Boolean(user?.emailVerified));
    };
    sync(auth.currentUser);
    return onIdTokenChanged(auth, sync);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
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
      await sendHotTakeEmailVerification(user);
      setInfo(`Verification link sent to ${user.email ?? 'your email'}.`);
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(mapAuthError(err?.code));
    } finally {
      setBusy(false);
    }
  }, []);

  const onCheckVerified = async () => {
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
      } else {
        setInfo('Email verified. Thanks!');
        setVerified(true);
      }
    } catch (err) {
      setError(err?.message ?? 'Could not refresh your account. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (verified) {
    return (
      <section className="profile-task profile-task--done" aria-labelledby="profile-email-task-title">
        <h3 id="profile-email-task-title" className="profile-task__title">
          Verify your email
        </h3>
        <p className="profile-task__status profile-task__status--ok" role="status">
          Verified — {email || 'your address'} is confirmed.
        </p>
      </section>
    );
  }

  return (
    <section className="profile-task profile-task--pending" aria-labelledby="profile-email-task-title">
      <h3 id="profile-email-task-title" className="profile-task__title">
        Verify your email
      </h3>
      <p className="profile-task__lead">
        Optional but recommended. We&apos;ll send a link to{' '}
        <strong>{email || 'your inbox'}</strong> so you can recover your account and unlock future
        features.
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

      <div className="profile-task__actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={sendVerification}
          disabled={busy || cooldown > 0}
        >
          {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Send verification email'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCheckVerified} disabled={busy}>
          {busy ? 'Checking…' : "I've verified — check status"}
        </button>
      </div>
    </section>
  );
}
