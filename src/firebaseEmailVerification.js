import { sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase.js';

/**
 * Continue URL for verification / password-reset links (Firebase Console must allowlist this domain).
 * Set VITE_APP_URL in production (e.g. https://hottake.com) so links return to your site, not localhost.
 */
export function getEmailActionCodeSettings() {
  const fromEnv = import.meta.env.VITE_APP_URL?.trim();
  const origin =
    fromEnv ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');

  if (!origin || origin === 'null') {
    return undefined;
  }

  const base = origin.replace(/\/$/, '');
  return {
    url: `${base}/`,
    handleCodeInApp: false,
  };
}

/** Sends Firebase email verification using production continue URL when configured. */
export async function sendHotTakeEmailVerification(user) {
  const actionCodeSettings = getEmailActionCodeSettings();
  if (actionCodeSettings) {
    await sendEmailVerification(user, actionCodeSettings);
  } else {
    await sendEmailVerification(user);
  }
}

/** Password reset email (same continue URL / Firebase template branding as verification). */
export async function sendHotTakePasswordResetEmail(email) {
  if (!auth) {
    throw new Error('Firebase is not configured.');
  }
  const actionCodeSettings = getEmailActionCodeSettings();
  if (actionCodeSettings) {
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
  } else {
    await sendPasswordResetEmail(auth, email);
  }
}
