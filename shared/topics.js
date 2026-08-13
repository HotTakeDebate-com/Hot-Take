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
    id: 'children-no-gender-reassignment-regardless-parent-consent',
    label:
      'Children should not be able to get gender reassignment surgery, hormones, or drugs regardless of whether their parents consent to it.',
  },
  {
    id: 'god-is-real',
    label: 'God is real.',
  },
  {
    id: 'second-amendment-protected-at-all-costs',
    label:
      'The Second Amendment should be protected at all costs; people have the right to bear arms.',
  },
];

export const ALLOWED_TOPIC_IDS = new Set(TOPICS.map((t) => t.id));
