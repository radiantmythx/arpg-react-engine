export function createSkillGemItem(offer) {
  const uid = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `skill_gem_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  return {
    uid,
    id: `skill_gem_${String(offer.id).toLowerCase()}`,
    type: 'skill_gem',
    skillOfferId: offer.id,
    name: `${offer.name} Gem`,
    rarity: 'magic',
    slot: 'gem',
    gridW: 1,
    gridH: 1,
    gemIcon: offer.isActiveSkill ? '✦' : '◇',
    description: `Learn ${offer.name}. ${offer.description}`,
    affixes: [],
  };
}
