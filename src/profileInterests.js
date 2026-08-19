export const MAX_PROFILE_INTERESTS = 5;

export const PROFILE_INTEREST_GROUPS = [
  { label: 'Political Identity', description: 'How you identify politically or ideologically.', options: [
    'Democrat', 'Republican', 'Independent', 'Progressive', 'Liberal', 'Centrist', 'Moderate', 'Conservative', 'Libertarian', 'Socialist', 'Populist', 'MAGA', 'Social Democrat', 'Nationalist', 'Globalist',
  ] },
  { label: 'Religion & Worldview', description: 'Your faith, philosophy, or broader outlook on life.', options: [
    'Christian', 'Muslim', 'Jewish', 'Buddhist', 'Atheist', 'Agnostic', 'Secular', 'Spiritual', 'Stoic', 'Existentialist', 'Theology', 'Moral Philosophy', 'Political Philosophy',
  ] },
  { label: 'Social Issues & Movements', description: 'The causes and social questions you care about.', options: [
    'Black Lives Matter', 'All Lives Matter', 'Racial Justice', 'LGBTQ+ Rights', 'Gender Equality', 'Pro-Choice', 'Pro-Life', 'Modern Feminism', 'Men’s Issues', 'Women’s Issues', 'Disability Rights', 'Workers’ Rights', 'Human Rights', 'Religious Freedom', 'Personal Freedom',
  ] },
  { label: 'Government, Law & Rights', description: 'Public policy, individual rights, and the role of government.', options: [
    'Pro-Democracy', 'Small Government', 'Electoral Reform', 'Free Speech', 'Gun Rights', 'Gun Control', 'Immigration Reform', 'Strong Borders', 'Criminal Justice Reform', 'Police Reform', 'Universal Healthcare', 'School Choice', 'Drug Decriminalization', 'Death Penalty', 'Education Reform', 'Social Media Reform',
  ] },
  { label: 'Economics', description: 'Economic systems, work, taxes, and public spending.', options: [
    'Free Markets', 'Capitalism', 'Social Democracy', 'Wealth Redistribution', 'Lower Taxes', 'Higher Minimum Wage', 'Universal Basic Income', 'Labor Unions', 'Affordable Housing', 'Fiscal Responsibility', 'Corporate Regulation', 'International Trade', 'Cryptocurrency',
  ] },
  { label: 'Science & Technology', description: 'New technology, scientific progress, energy, and the environment.', options: [
    'Science', 'Technology', 'Artificial Intelligence', 'AI Regulation', 'Online Privacy', 'Tech Ethics', 'Space Exploration', 'Nuclear Energy', 'Renewable Energy', 'Biotechnology', 'Transhumanism', 'Climate Action', 'Climate Skepticism',
  ] },
  { label: 'Health & Wellness', description: 'Diet, exercise, mental health, body image, and approaches to wellbeing.', options: [
    'Vegan', 'Vegetarian', 'Plant-Based', 'Pescatarian', 'Omnivore', 'Carnivore', 'Raw Primal', 'Keto', 'Intermittent Fasting', 'Whole Foods', 'Animal Rights', 'Fitness', 'Resistance Training', 'Bodybuilding', 'Running', 'Yoga', 'Holistic Health', 'Mental Health', 'Public Health', 'Medical Freedom', 'Body Positivity', 'Fat Acceptance', 'Fatphobia',
  ] },
  { label: 'World Affairs', description: 'International relations, security, and regional politics.', options: [
    'Foreign Policy', 'National Security', 'Diplomacy', 'Military Affairs', 'Global Development', 'Israel–Palestine', 'Ukraine–Russia', 'China–US Relations', 'European Politics', 'Middle Eastern Politics',
  ] },
  { label: 'Culture & Society', description: 'The cultural subjects and everyday issues you like discussing.', options: [
    'Politics', 'Philosophy', 'Religion', 'Ethics', 'Economics', 'History', 'Law', 'Culture', 'Current Events', 'Traditional Values', 'Family Values', 'Cultural Preservation', 'Multiculturalism', 'Cancel Culture', 'Media Bias', 'Parenting', 'Dating & Relationships', 'Relationship Debates',
  ] },
  { label: 'Debate Style', description: 'How you prefer to approach disagreement and conversation.', options: [
    'Open-Minded', 'Evidence-First', 'Devil’s Advocate', 'Socratic', 'Policy-Focused', 'Philosophical', 'Direct', 'Diplomatic', 'Beginner-Friendly', 'Casual Debates', 'Competitive', 'Competitive Debate', 'Long-Form', 'Rapid-Fire',
  ] },
];

const PROFILE_INTEREST_OPTIONS = new Set(PROFILE_INTEREST_GROUPS.flatMap((group) => group.options));
const LEGACY_INTEREST_LABELS = {
  Christianity: 'Christian', Islam: 'Muslim', Judaism: 'Jewish', Buddhism: 'Buddhist',
  Atheism: 'Atheist', Agnosticism: 'Agnostic', Secularism: 'Secular', Spirituality: 'Spiritual',
  Stoicism: 'Stoic', Existentialism: 'Existentialist',
  Nationalism: 'Nationalist', Globalism: 'Globalist',
};

export function sanitizeProfileInterests(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((interest) => LEGACY_INTEREST_LABELS[interest] || interest))]
    .filter((interest) => typeof interest === 'string' && PROFILE_INTEREST_OPTIONS.has(interest))
    .slice(0, MAX_PROFILE_INTERESTS);
}
