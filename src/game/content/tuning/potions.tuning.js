export const POTION_TUNING = {
  slotCount: 4,
  killGainNormal: 1,
  killGainChampion: 3,
  killGainBoss: 10,
  dropChanceNormal: 0.018,
  dropChanceChampion: 0.07,
  dropChanceBoss: 0.75,
  // Baseline passive refill is zero; passives/items/affixes can raise this.
  baseChargeRegenPerS: 0,
  areaLevelPivot: 1,
  effectPerAreaLevel: 0.008,
  effectAreaCap: 2.1,
  maxChargesPerAreaLevel: 0.002,
  maxChargesAreaCap: 1.28,
  // Safety clamps for runtime scaling modifiers sourced from player stats.
  minDurationMult: 0.25,
  minEffectMult: 0.25,
  minMaxChargesMult: 0.25,
  minChargesPerUseMult: 0.25,
};
