export const MAX_PROFILE_INTERESTS = 5;

export const PROFILE_INTEREST_GROUPS = [
  { label: 'Viewpoints', description: 'The positions and values that shape your perspective.', options: [
    'Progressive', 'Liberal', 'Centrist', 'Moderate', 'Conservative', 'Libertarian', 'Socialist', 'Populist', 'Independent', 'Pro-Democracy', 'Small Government', 'Electoral Reform', 'Free Speech', 'Gun Rights', 'Gun Control', 'Immigration Reform', 'Strong Borders', 'Pro-Choice', 'Pro-Life', 'LGBTQ+ Rights', 'Religious Freedom', 'Gender Equality', 'Racial Justice', 'Criminal Justice Reform', 'Police Reform', 'Disability Rights', 'Workers’ Rights', 'Universal Healthcare', 'School Choice', 'Drug Decriminalization', 'Death Penalty', 'Animal Rights', 'Free Markets', 'Capitalism', 'Social Democracy', 'Wealth Redistribution', 'Lower Taxes', 'Higher Minimum Wage', 'Universal Basic Income', 'Labor Unions', 'Affordable Housing', 'Fiscal Responsibility', 'Corporate Regulation', 'Climate Action', 'Climate Skepticism', 'Traditional Values', 'Personal Freedom', 'Family Values', 'Modern Feminism', 'Cultural Preservation', 'Multiculturalism', 'Nationalism', 'Globalism',
  ] },
  { label: 'Topics', description: 'The subjects you most want to discuss and debate.', options: [
    'Politics', 'Philosophy', 'Religion', 'Ethics', 'Economics', 'Science', 'Technology', 'History', 'Law', 'Culture', 'Current Events', 'Artificial Intelligence', 'AI Regulation', 'Online Privacy', 'Tech Ethics', 'Space Exploration', 'Nuclear Energy', 'Renewable Energy', 'Biotechnology', 'Transhumanism', 'Social Media Reform', 'Atheism', 'Agnosticism', 'Christianity', 'Islam', 'Judaism', 'Buddhism', 'Secularism', 'Spirituality', 'Stoicism', 'Existentialism', 'Moral Philosophy', 'Political Philosophy', 'Theology', 'Cancel Culture', 'Media Bias', 'Education Reform', 'Parenting', 'Dating & Relationships', 'Men’s Issues', 'Women’s Issues', 'Foreign Policy', 'Human Rights', 'National Security', 'Diplomacy', 'Military Affairs', 'International Trade', 'Global Development', 'Israel–Palestine', 'Ukraine–Russia', 'China–US Relations', 'European Politics', 'Middle Eastern Politics', 'Relationship Debates', 'Casual Debates', 'Competitive Debate', 'Cryptocurrency',
  ] },
  { label: 'Debate Style', description: 'How you prefer to approach a disagreement.', options: [
    'Open-Minded', 'Evidence-First', 'Devil’s Advocate', 'Socratic', 'Policy-Focused', 'Philosophical', 'Direct', 'Diplomatic', 'Beginner-Friendly', 'Competitive', 'Long-Form', 'Rapid-Fire',
  ] },
];

const PROFILE_INTEREST_OPTIONS = new Set(PROFILE_INTEREST_GROUPS.flatMap((group) => group.options));

export function sanitizeProfileInterests(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value)]
    .filter((interest) => typeof interest === 'string' && PROFILE_INTEREST_OPTIONS.has(interest))
    .slice(0, MAX_PROFILE_INTERESTS);
}
