import { useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from './firebase.js';
import { sendHotTakePasswordResetEmail } from './firebaseEmailVerification.js';
import BrandLogo from './BrandLogo.jsx';
import LegalViewer from './legal/LegalViewer.jsx';
import SignupLegalReview from './SignupLegalReview.jsx';
import { HotTakeWordmark, IconLightning, IconShield, IconUser } from './LandingAssets.jsx';
import './AuthScreen.css';
import './AuthProviderFix.css';

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
      return 'Email/password sign-in is not enabled in Firebase Console (Authentication ? Sign-in method).';
    default:
      return 'Something went wrong. Try again.';
  }
}

export default function AuthScreen({ variant = 'page', initialMode = 'signin', onClose = null }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [legalDoc, setLegalDoc] = useState(null);
  /** Signup only: must complete full legal review before account fields appear. */
  const [signupPhase, setSignupPhase] = useState('legal');
  const [agreeAge18, setAgreeAge18] = useState(false);
  const [agreePolicies, setAgreePolicies] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  const avatarInputRef = useRef(null);
  const signupCertifyRef = useRef(null);

  const resetLegal = () => {
    setSignupPhase('legal');
    setAgreeAge18(false);
    setAgreePolicies(false);
  };

  const goToSignIn = () => {
    setMode('signin');
    setError(null);
    setDisplayName('');
    resetLegal();
  };

  const goToSignUp = () => {
    setMode('signup');
    setError(null);
    setDisplayName('');
    resetLegal();
  };

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    if (initialMode === 'signin') {
      resetLegal();
    }
  }, [initialMode]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

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
      if (signupPhase !== 'account') {
        setError('Please read all four policy documents before creating an account.');
        return;
      }
      if (!agreeAge18 || !agreePolicies) {
        setError(
          'Please confirm you are at least 18 and accept the Terms of Service, Privacy Policy, Community Guidelines, and Recording Agreement.'
        );
        return;
      }
      const name = displayName.trim();
      if (name.length > 100) {
        setError('Display name must be 100 characters or fewer.');
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const normalizedEmail = email.trim().toLowerCase();
        const validationResponse = await fetch('/api/auth/validate-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail }),
        });
        const validationResult = await validationResponse.json().catch(() => ({}));
        if (!validationResponse.ok || validationResult?.ok !== true) {
          const validationError = new Error(
            validationResult?.message ||
              'We could not confirm that this email can receive messages. Check it and try again.'
          );
          validationError.code = 'email-validation/failed';
          throw validationError;
        }

        const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        const name = displayName.trim();
        if (name) {
          try {
            await updateProfile(cred.user, { displayName: name.slice(0, 100) });
          } catch {
            /* profile update is optional; account still exists */
          }
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(
        err?.code === 'email-validation/failed'
          ? err.message
          : mapAuthError(err?.code)
      );
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
      await sendHotTakePasswordResetEmail(email.trim());
      setResetSent(true);
    } catch (err) {
      setError(mapAuthError(err?.code));
    } finally {
      setBusy(false);
    }
  };

  const onProviderSignIn = async (kind) => {
    setError(null);
    if (!auth) { setError('Firebase is not configured.'); return; }
    if (mode === 'signup' && !signupReady) {
      setError('Please confirm you are at least 18 and accept all policies before continuing.');
      requestAnimationFrame(() => signupCertifyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    setBusy(true);
    try {
      const provider = kind === 'google' ? new GoogleAuthProvider() : new OAuthProvider('apple.com');
      if (kind === 'google') provider.setCustomParameters({ prompt: 'select_account' });
      else provider.addScope('email');
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err?.code === 'auth/operation-not-allowed') setError(`${kind === 'google' ? 'Google' : 'Apple'} sign-in is not enabled in Firebase yet.`);
      else if (err?.code !== 'auth/popup-closed-by-user') setError(mapAuthError(err?.code));
    } finally { setBusy(false); }
  };

  const flipMode = () => {
    if (mode === 'signin') goToSignUp();
    else goToSignIn();
  };

  const signupLegalGate = mode === 'signup' && signupPhase === 'legal';
  const signupReady = signupPhase === 'account' && agreeAge18 && agreePolicies;

  const screen = (
    <div className={['auth-screen', variant === 'modal' && 'auth-screen--modal', mode === 'signin' && 'auth-screen--signin', mode === 'signup' && 'auth-screen--signup', mode === 'signup' && signupPhase === 'account' && 'auth-screen--signup-account'].filter(Boolean).join(' ')}>
      {mode === 'signup' && signupPhase === 'account' && <header className="signup-new-header"><HotTakeWordmark variant="nav" /><div><span>Already have an account?</span><button type="button" onClick={goToSignIn}>Sign in</button><b>Create account</b></div></header>}
      {mode === 'signup' && signupPhase === 'account' && <aside className="signup-new-story"><h1>Real debates.<strong>Real people.</strong></h1><p>Hot Take is the 1-on-1 live debate platform where opposite perspectives meet.</p><ul><li><IconUser /><div><b>1-on-1 live debates</b><span>Match with real people and debate in real time.</span></div></li><li><IconShield /><div><b>Respect first</b><span>Clear guidelines and tools to keep the conversation fair.</span></div></li><li><IconLightning /><div><b>Diverse opinions</b><span>Explore new perspectives and challenge your own.</span></div></li></ul></aside>}
      {mode === 'signin' && <aside className="signin-new-story"><h1>Real debates.<strong>Real people.</strong></h1><i/><p>Hot Take is the 1-on-1 live debate platform where opposite perspectives meet.</p><ul><li><IconUser /><div><b>1-on-1 live debates</b><span>Match with real people and debate in real time.</span></div></li><li><IconShield /><div><b>Respect first</b><span>Clear guidelines and tools to keep the conversation fair.</span></div></li><li><IconLightning /><div><b>Diverse opinions</b><span>Explore new perspectives and challenge your own.</span></div></li></ul></aside>}
      {signupLegalGate && <header className="signup-new-header signup-policy-header"><HotTakeWordmark variant="nav" /><div><span>Already have an account?</span><button type="button" onClick={goToSignIn}>Sign in</button><b>Create account</b></div></header>}
      <div className="auth-screen-inner">
        <div
          className={['auth-screen-card', signupLegalGate && 'auth-screen-card--legal-gate']
            .filter(Boolean)
            .join(' ')}
        >
          {signupLegalGate ? (
            <>
              <div className="auth-screen-logo-wrap auth-policy-legacy-heading">
                <BrandLogo />
              </div>
              <h2 className="auth-screen-title auth-policy-legacy-heading">Review policies</h2>
              <p className="auth-screen-lead auth-policy-legacy-heading">
                Creating a Hot Take account requires reading all four policies in full. You cannot
                skip this step.
              </p>
              <SignupLegalReview onComplete={() => setSignupPhase('account')} />
              <button type="button" className="auth-linkish auth-legal-gate-back auth-policy-legacy-heading" onClick={goToSignIn}>
                Sign in instead
              </button>
            </>
          ) : (
            <>
          {mode === 'signup' && signupPhase === 'account' && (
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
          <div className="auth-screen-logo-wrap auth-screen-logo-wrap--form">
            <BrandLogo />
          </div>
          <h2 className="auth-screen-title">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="auth-screen-lead">
            {mode === 'signin' ? (
              <>
                Sign in to your Hot Take account and continue debating.
              </>
            ) : (
              <>
                Set up your account in a minute and start debating.
              </>
            )}
          </p>


          {mode === 'signup' && signupPhase === 'account' && <><button type="button" className="signup-google-button" onClick={() => onProviderSignIn('google')} disabled={busy}><svg className="provider-google" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.6h3.2c1.9-1.7 3-4.3 3-7.5Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.3l-3.2-2.6c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-4V7.3H3A10 10 0 0 0 3 16.7L6.4 14Z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.3L6.4 10c.8-2.3 3-4.1 5.6-4.1Z"/></svg>Continue with Google</button><div className="signup-provider-or"><span />or sign up with email<span /></div></>}

          {mode === 'signin' && <><div className="signin-provider-row"><button type="button" onClick={() => onProviderSignIn('google')} disabled={busy}><svg className="provider-google" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.6h3.2c1.9-1.7 3-4.3 3-7.5Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.3l-3.2-2.6c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-4V7.3H3A10 10 0 0 0 3 16.7L6.4 14Z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.3L6.4 10c.8-2.3 3-4.1 5.6-4.1Z"/></svg>Continue with Google</button><button type="button" onClick={() => onProviderSignIn('apple')} disabled={busy}><svg className="provider-apple" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 12.5c0-3 2.5-4.5 2.6-4.5a5.5 5.5 0 0 0-4.3-2.3c-1.8-.2-3.6 1.1-4.5 1.1-.9 0-2.4-1.1-3.9-1.1A5.7 5.7 0 0 0 2.1 8.7c-2.1 3.6-.5 9 1.5 11.9 1 1.4 2.2 3 3.7 3 1.5-.1 2.1-1 3.9-1s2.3 1 3.9.9c1.6 0 2.6-1.5 3.6-2.9a12 12 0 0 0 1.6-3.3 5.2 5.2 0 0 1-3.3-4.8ZM14.1 3.7A5.3 5.3 0 0 0 15.3 0a5.4 5.4 0 0 0-3.5 1.8 5.1 5.1 0 0 0-1.2 3.6c1.3.1 2.6-.6 3.5-1.7Z"/></svg>Continue with Apple</button></div><div className="signin-or"><span />or<span /></div></>}

          {mode === 'signup' && signupPhase === 'account' && (
            <button
              type="button"
              className="auth-linkish auth-review-policies-again"
              onClick={() => {
                setSignupPhase('legal');
                setAgreeAge18(false);
                setAgreePolicies(false);
              }}
            >
              Review policies again
            </button>
          )}

          <div className="auth-tabs auth-tabs--form">
            <button
              type="button"
              className={`auth-tab ${mode === 'signin' ? 'auth-tab--active' : ''}`}
              onClick={goToSignIn}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === 'signup' ? 'auth-tab--active' : ''}`}
              onClick={goToSignUp}
            >
              Create account
            </button>
          </div>

          <button type="button" className="auth-screen-alt-link auth-screen-alt-link--form" onClick={flipMode}>
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
              placeholder="you@example.com"
            />
            {mode === 'signup' && (
              <p className="auth-field-hint">This is your sign-in email. Verify it later from Profile if you like.</p>
            )}

            {mode === 'signin' && <div className="signin-options"><label><input type="checkbox" checked={rememberMe} onChange={(e)=>setRememberMe(e.target.checked)}/> Remember me</label><button type="button" onClick={onForgotPassword} disabled={busy}>Forgot password?</button></div>}

            {mode === 'signup' && (
              <>
                <label className="auth-label" htmlFor="auth-display-name">
                  Display name <span className="auth-optional">(optional)</span>
                </label>
                <input
                  id="auth-display-name"
                  className="auth-input"
                  type="text"
                  autoComplete="name"
                  placeholder="How should others see you?"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={100}
                />
              </>
            )}

            <div className="auth-password-row">
              <label className="auth-label auth-password-row__label" htmlFor="auth-password">
                Password
              </label>
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-pressed={showPassword}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="auth-password"
              className="auth-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Enter a password"
            />
            {mode === 'signup' && (
              <p className="auth-field-hint">At least 6 characters (pick something you don&apos;t reuse elsewhere).</p>
            )}

            {mode === 'signup' && (
              <>
                <label className="auth-label auth-screen-label" htmlFor="auth-confirm">
                  Confirm password
                </label>
                <input
                  id="auth-confirm"
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Confirm your password"
                />

                <div ref={signupCertifyRef} className="auth-screen-certify" tabIndex={-1}>
                  <p className="auth-screen-certify-intro">
                    By creating an account, you agree that:
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
              {busy ? 'Please wait?' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {mode === 'signin' && false && (
            <button type="button" className="auth-linkish" onClick={onForgotPassword} disabled={busy}>
              Forgot password?
            </button>
          )}

          <p className="auth-screen-footer-hint auth-screen-footer-hint--form">
            Policies:{' '}
            <button type="button" onClick={() => setLegalDoc('terms')}>
              Terms
            </button>
            <span aria-hidden> ? </span>
            <button type="button" onClick={() => setLegalDoc('privacy')}>
              Privacy
            </button>
            <span aria-hidden> ? </span>
            <button type="button" onClick={() => setLegalDoc('community')}>
              Guidelines
            </button>
            <span aria-hidden> ? </span>
            <button type="button" onClick={() => setLegalDoc('recording')}>
              Recording
            </button>
          </p>
            </>
          )}
        </div>
      </div>

      {legalDoc && !signupLegalGate && (
        <LegalViewer documentId={legalDoc} onBack={() => setLegalDoc(null)} />
      )}
    </div>
  );

  if (variant === 'modal' && onClose) {
    return (
      <div
        className="auth-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={initialMode === 'signup' ? 'Create account' : 'Sign in'}
        onMouseDown={onClose}
      >
        <div className="auth-modal-dialog" onMouseDown={(e) => e.stopPropagation()}>
          <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Close">
            ?
          </button>
          {screen}
        </div>
      </div>
    );
  }

  return screen;
}
