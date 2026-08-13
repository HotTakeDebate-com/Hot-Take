/**
 * Quick match statements. Each topic has a stable `id` for queues / Firestore.
 * Server allowlist: ALLOWED_TOPIC_IDS.
 */
export const TOPICS = [
  {
    id: 'abortion-morally-wrong-not-allowed',
    label: 'Abortion is morally wrong and should not be allowed.',
  },
  {
    id: 'eating-meat-unnecessary-cruelty-pleasure',
    label:
      'Eating meat is unnecessary cruelty — you are choosing to kill animals for pleasure.',
  },
  {
    id: 'free-speech-includes-hate-speech',
    label: 'Free speech should include all forms of hate speech.',
  },
  {
    id: 'god-is-real',
    label: 'God is real.',
  },
  {
    id: 'past-sexual-experiences-not-define-value',
    label:
      "A person's past sexual experiences should not define their value or relationship potential.",
  },
];

export const ALLOWED_TOPIC_IDS = new Set(TOPICS.map((t) => t.id));
