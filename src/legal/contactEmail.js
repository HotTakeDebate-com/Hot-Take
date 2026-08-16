/** Canonical public contact used across Support, FAQ, Privacy, and Recording pages. */
const SUPPORT_EMAIL = 'support@hottakedebate.com';

export function getContactEmail() {
  return SUPPORT_EMAIL;
}

export function contactEmailLabel() {
  return SUPPORT_EMAIL;
}

export function contactEmailMailto() {
  return `mailto:${SUPPORT_EMAIL}`;
}
