import { useEffect, useState } from 'react';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from './firebase.js';
import { HotTakeWordmark } from './LandingAssets.jsx';
import './PasswordResetAction.css';

export default function PasswordResetAction({ code }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    verifyPasswordResetCode(auth, code)
      .then((address) => {
        if (!active) return;
        setEmail(address || '');
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setError('This password-reset link is invalid or has expired. Request a new link from the sign-in screen.');
        setStatus('error');
      });
    return () => { active = false; };
  }, [code]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Your new password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match. Type the same password in both fields.');
      return;
    }
    setStatus('saving');
    try {
      await confirmPasswordReset(auth, code, password);
      setStatus('complete');
      setPassword('');
      setConfirm('');
    } catch {
      setError('The password could not be changed. The link may have expired; request a new reset email and try again.');
      setStatus('ready');
    }
  };

  const returnToSignIn = () => {
    window.history.replaceState({}, '', '/');
    window.location.reload();
  };

  return <main className="password-reset-action">
    <section className="password-reset-card">
      <HotTakeWordmark variant="nav" />
      <p className="password-reset-eyebrow">Account security</p>
      {status === 'checking' && <><h1>Checking your link<span>.</span></h1><p>Please wait while we securely verify your password-reset request.</p></>}
      {status === 'error' && <><h1>Link unavailable<span>.</span></h1><div className="password-reset-message is-error">{error}</div><button type="button" className="password-reset-primary" onClick={returnToSignIn}>Return to sign in</button></>}
      {status === 'complete' && <><h1>Password changed<span>.</span></h1><p>Your new password is ready. You can now sign in to Hot Take.</p><div className="password-reset-message is-success">Your password was changed successfully.</div><button type="button" className="password-reset-primary" onClick={returnToSignIn}>Continue to sign in</button></>}
      {(status === 'ready' || status === 'saving') && <>
        <h1>Choose a new password<span>.</span></h1>
        <p>Enter your new password twice to make sure it is correct.</p>
        {email && <small className="password-reset-account">Resetting password for {email}</small>}
        {error && <div className="password-reset-message is-error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <div className="password-reset-label-row"><label htmlFor="new-password">New password</label><button type="button" onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? 'Hide' : 'Show'}</button></div>
          <input id="new-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} autoComplete="new-password" required />
          <label htmlFor="confirm-new-password">Confirm new password</label>
          <input id="confirm-new-password" type={showPassword ? 'text' : 'password'} value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={6} autoComplete="new-password" required />
          <button type="submit" className="password-reset-primary" disabled={status === 'saving'}>{status === 'saving' ? 'Changing password…' : 'Change password'}</button>
        </form>
      </>}
    </section>
  </main>;
}
