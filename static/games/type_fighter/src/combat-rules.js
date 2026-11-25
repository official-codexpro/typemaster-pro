export function chooseNonRepeatingAttack(attackTypes, previousType, random = Math.random) {
  const alternatives = attackTypes.filter((type) => type !== previousType);
  const choices = alternatives.length ? alternatives : attackTypes;
  if (!choices.length) return null;
  const index = Math.min(choices.length - 1, Math.floor(random() * choices.length));
  return choices[index];
}

export function applyParagraphGatedDamage(health, damage, paragraphComplete = false) {
  const floor = paragraphComplete ? 0 : 1;
  const appliedDamage = Math.min(Math.max(0, health - floor), Math.max(0, damage));
  return {
    health: health - appliedDamage,
    appliedDamage,
    pendingDefeat: !paragraphComplete && health > 0 && damage >= health,
  };
}
