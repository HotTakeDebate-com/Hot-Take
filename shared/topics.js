/**
 * Quick match statements. Each topic has a stable `id` for queues / Firestore.
 * Server allowlist: ALLOWED_TOPIC_IDS.
 */
export const TOPICS = [
  {
    id: 'feeding-children-junk-food-abusive',
    label: 'Feeding children junk food is abusive.',
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
    id: 'jesus-is-god',
    label: 'Jesus is God.',
  },
  {
    id: 'past-sexual-experiences-not-define-value',
    label:
      "A person's past sexual experiences should not define their value or relationship potential.",
  },
];

export const ALLOWED_TOPIC_IDS = new Set(TOPICS.map((t) => t.id));
