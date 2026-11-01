export function getScoreTier(pointsEarned, pointsPossible) {
  if (pointsPossible <= 0 || pointsEarned == null) return 'neutral';
  const pct = (pointsEarned / pointsPossible) * 100;
  if (pct <= 60) return 'red';
  if (pct <= 80) return 'yellow';
  return 'green';
}

export function scoreTierClassName(tier) {
  if (!tier || tier === 'neutral') return 'ba-quiz-score';
  return `ba-quiz-score ba-quiz-score--${tier}`;
}

export function scoreTierLabel(tier) {
  if (tier === 'red') return 'Needs improvement';
  if (tier === 'yellow') return 'Partial credit';
  if (tier === 'green') return 'Strong';
  return '';
}

export function scoreTierBoxClassName(tier) {
  if (!tier || tier === 'neutral') return 'ba-quiz-submissions-score';
  return `ba-quiz-submissions-score ba-quiz-submissions-score--${tier}`;
}
