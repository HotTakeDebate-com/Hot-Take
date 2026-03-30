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
      },
      {
        id: 'censorship-more-dangerous-than-misinformation',
        label: 'Censorship is more dangerous than misinformation.',
      },
      {
        id: 'democratic-capitalism-failing-needs-replacement',
        label: 'Democratic Capitalism is failing and needs to be replaced.',
      },
    ],
  },
  {
    id: 'health-wellness',
    label: 'Health and Wellness',
    topics: [
      {
        id: 'feeding-children-junk-food-abusive',
        label: 'Feeding children junk food is abusive.',
      },
      {
        id: 'vegetables-not-optimal-human-diet',
        label: 'Vegetables are not optimal in the human diet.',
      },
      {
        id: 'eating-meat-unnecessary-cruelty-pleasure',
        label:
          "Eating meat is unnecessary cruelty — you're choosing to kill animals for pleasure.",
      },
    ],
  },
];

export const TOPICS = TOPIC_CATEGORIES.flatMap((c) => c.topics);

export const ALLOWED_TOPIC_IDS = new Set(TOPICS.map((t) => t.id));
