import { useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from './firebase.js';
import BrandLogo from './BrandLogo.jsx';
import LegalViewer from './legal/LegalViewer.jsx';
import './AuthScreen.css';

function mapAuthError(code) {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email is already registered. Sign in instead.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Use at least 6 characters for your password.';
    case 'auth/user-not-found':
      return 'No account found for that email.';
    case 'auth/wrong-password':
      return 'Wrong password.';
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a few minutes.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled in Firebase Console (Authentication → Sign-in method).';
    default:
      return 'Something went wrong. Try again.';
  }
}

export default function AuthScreen() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [legalDoc, setLegalDoc] = useState(null);
  const [agreeAge18, setAgreeAge18] = useState(false);
  const [agreePolicies, setAgreePolicies] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  const avatarInputRef = useRef(null);

  const resetLegal = () => {
    setAgreeAge18(false);
    setAgreePolicies(false);
  };

  const onChooseAvatar = () => {
    avatarInputRef.current?.click();
  };

  const onAvatarSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResetSent(false);
    if (!auth) {
      setError('Firebase is not configured.');
      return;
    }
    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup') {
      if (!agreeAge18 || !agreePolicies) {
        setError(
          'Please confirm you are at least 18 and accept the Terms of Service, Privacy Policy, Community Guidelines, and Recording Agreement.'
        );
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        try {
          await sendEmailVerification(cred.user);
        } catch {
          /* user can use Resend on the verify screen */
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(mapAuthError(err?.code));
    } finally {
      setBusy(false);
    }
  };

  const onForgotPassword = async () => {
    setError(null);
    setResetSent(false);
    if (!email.trim()) {
      setError('Enter your email above, then click Forgot password again.');
      return;
    }
    if (!auth) return;
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (err) {
      setError(mapAuthError(err?.code));
    } finally {
      setBusy(false);
    }
  };

  const flipMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
    resetLegal();
  };

  const signupReady = agreeAge18 && agreePolicies;

  return (
    <div className="auth-screen">
      <div className="auth-screen-inner">
        <div className="auth-screen-card">
          {mode === 'signup' && (
            <>
              <button
                type="button"
                className="auth-avatar-icon"
                aria-label="Choose an avatar picture"
                onClick={onChooseAvatar}
              >
                {avatarPreviewUrl ? (
                  <img className="auth-avatar-icon__img" src={avatarPreviewUrl} alt="" />
                ) : (
                  <svg
                    className="auth-avatar-icon__svg"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 7.5C4 6.11929 5.11929 5 6.5 5H17.5C18.8807 5 20 6.11929 20 7.5V16.5C20 17.8807 18.8807 19 17.5 19H6.5C5.11929 19 4 17.8807 4 16.5V7.5Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M8 10.2C9.10457 10.2 10 9.30457 10 8.2C10 7.09543 9.10457 6.2 8 6.2C6.89543 6.2 6 7.09543 6 8.2C6 9.30457 6.89543 10.2 8 10.2Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M4.7 17.4L10.4 12.2C11.0 11.6 11.9 11.6 12.5 12.2L14.7 14.2L17 12.1C17.6 11.5 18.6 11.5 19.2 12.1L20 12.9"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="auth-avatar-input"
                onChange={onAvatarSelected}
              />
            </>
          )}
          <div className="auth-screen-logo-wrap">
            <BrandLogo />
          </div>
          <h2 className="auth-screen-title">{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
          <p className="auth-screen-lead">
            Chitchat — structured debate with people who disagree. Sign in with a real email; new accounts
            must confirm the link we send before playing.
          </p>

          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${mode === 'signin' ? 'auth-tab--active' : ''}`}
              onClick={() => {
                setMode('signin');
                setError(null);
                resetLegal();
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === 'signup' ? 'auth-tab--active' : ''}`}
              onClick={() => {
                setMode('signup');
                setError(null);
                resetLegal();
              }}
            >
              Create account
            </button>
          </div>

          <button type="button" className="auth-screen-alt-link" onClick={flipMode}>
            {mode === 'signup' ? 'More sign-in options' : 'Create an account'}
          </button>

          <form className="auth-form" onSubmit={onSubmit}>
            <label className="auth-label" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              className="auth-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label className="auth-label" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              className="auth-input"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />

            {mode === 'signup' && (
              <>
                <label className="auth-label auth-screen-label" htmlFor="auth-confirm">
                  Confirm password
                </label>
                <input
                  id="auth-confirm"
                  className="auth-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                />

                <div className="auth-screen-certify">
                  <p className="auth-screen-certify-intro">
                    By creating account or logging in, you certify that
                  </p>
                  <div className="auth-legal-block" role="group" aria-label="Certification">
                    <label className="auth-legal-row">
                      <input
                        type="checkbox"
                        checked={agreeAge18}
                        onChange={(e) => setAgreeAge18(e.target.checked)}
                      />
                      <span>I am at least 18 years old.</span>
                    </label>
                    <label className="auth-legal-row">
                      <input
                        type="checkbox"
                        checked={agreePolicies}
                        onChange={(e) => setAgreePolicies(e.target.checked)}
                      />
                      <span>
                        I have read and agree to the{' '}
                        <button
                          type="button"
                          className="auth-legal-link"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLegalDoc('terms');
                          }}
                        >
                          Terms of Service
                        </button>
                        ,{' '}
                        <button
                          type="button"
                          className="auth-legal-link"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLegalDoc('privacy');
                          }}
                        >
                          Privacy Policy
                        </button>
                        ,{' '}
                        <button
                          type="button"
                          className="auth-legal-link"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLegalDoc('community');
                          }}
                        >
                          Community Guidelines
                        </button>
                        , and{' '}
                        <button
                          type="button"
                          className="auth-legal-link"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLegalDoc('recording');
                          }}
                        >
                          Recording Agreement
                        </button>
                        .
                      </span>
                    </label>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            {resetSent && (
              <p className="auth-success" role="status">
                Check your email for a password reset link.
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={busy || (mode === 'signup' && !signupReady)}
            >
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {mode === 'signin' && (
            <button type="button" className="auth-linkish" onClick={onForgotPassword} disabled={busy}>
              Forgot password?
            </button>
          )}

          <p className="auth-screen-footer-hint">
            Policies:{' '}
            <button type="button" onClick={() => setLegalDoc('terms')}>
              Terms
            </button>
            <span aria-hidden> · </span>
            <button type="button" onClick={() => setLegalDoc('privacy')}>
              Privacy
            </button>
            <span aria-hidden> · </span>
            <button type="button" onClick={() => setLegalDoc('community')}>
              Guidelines
            </button>
            <span aria-hidden> · </span>
            <button type="button" onClick={() => setLegalDoc('recording')}>
              Recording
            </button>
          </p>
        </div>
      </div>

      {legalDoc && <LegalViewer documentId={legalDoc} onBack={() => setLegalDoc(null)} />}
    </div>
  );
}
