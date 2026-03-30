/**
 * Quick match: topics grouped by category. Each topic has a stable `id` for queues / Firestore.
 * Server allowlist: ALLOWED_TOPIC_IDS (derived from all topics in categories).
 */
export const TOPIC_CATEGORIES = [
  {
    id: 'society-government',
    label: 'Society / Government',
    topics: [
      {
        id: 'free-speech-includes-hate-speech',
        label: 'Free speech should include all forms of hate speech.',
        blurb: 'Argue for or against broad legal protection of hateful expression.',
      },
    ],
  },
];

export const TOPICS = TOPIC_CATEGORIES.flatMap((c) => c.topics);

export const ALLOWED_TOPIC_IDS = new Set(TOPICS.map((t) => t.id));
