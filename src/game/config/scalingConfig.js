export const SCALING_CONFIG = {
  version: '1.1.0',
  enemy: {
    levelMin: 1,
    levelMax: 100,
    // Baseline challenge floor. Level 1 starts at 2x old baseline.
    scalingPivotAreaLevel: 1,
    baseLifeMultiplier: 2,
    baseDamageMultiplier: 2,
    baseXpMultiplier: 2,
    // More dramatic ramp for health/damage as levels rise.
    lifeLinear: 0.014,
    lifeQuad: 0.00045,
    damageLinear: 0.011,
    damageQuad: 0.00035,
    xpLinear: 0.009,
    xpQuad: 0.00028,
    speedPerLevel: 0.0025,
    speedCap: 0.22,
    armorPenPerLevel: 0.0035,
    armorPenCap: 0.35,
  },
  boss: {
    lifeMult: 1.8,
    damageMult: 1.45,
    mitigationPerLevel: 0.003,
    mitigationCap: 0.3,
  },
  eliteChampion: {
    eliteLife: 1.9,
    eliteDamage: 1.25,
    championLife: 2.6,
    championDamage: 1.38,
  },
  mapDrop: {
    campaignVariance: 2,
    instanceMinDelta: -5,
    instanceMaxDelta: 5,
    instanceWeights: [0.04, 0.03, 0.03, 0.09, 0.09, 0.22, 0.14, 0.14, 0.08, 0.08, 0.06],
    badLuckThreshold: 6,
    bossDropFloor: 0.35,
    normalKillDropChance: 0.025,
    championKillDropChance: 0.07,
    areaLevelBucketSize: 5,
  },
  actBands: [
    { act: 1, parts: [[1, 3], [4, 6], [7, 9], [10, 12]] },
    { act: 2, parts: [[13, 15], [16, 18], [19, 21], [22, 24]] },
    { act: 3, parts: [[25, 27], [28, 30], [31, 33], [34, 36]] },
    { act: 4, parts: [[37, 39], [40, 42], [43, 45], [46, 48]] },
    { act: 5, parts: [[49, 51], [52, 54], [55, 57], [58, 60]] },
  ],
  campaign: {
    zoneExitDeltaMin: 1,
    zoneExitDeltaMax: 3,
    zoneLevelVariance: 0,
  },
  gem: {
    active: {
      dmgPerLevel: 0.045,
      manaCostPerLevel: 0.012,
      cooldownPerLevel: -0.007,
      cooldownFloor: 0.78,
      castTimePerLevel: -0.005,
      castTimeFloor: 0.82,
      aoePerLevel: 0.009,
    },
    support: {
      throughput: { effectRange: [1.12, 1.32], manaMult: [1.35, 1.2] },
      utility: { effectRange: [1.06, 1.22], manaMult: [1.2, 1.1] },
      ailment: { effectRange: [1.1, 1.3], manaMult: [1.28, 1.16] },
    },
  },
  affixGates: {
    minor: 1,
    major: 25,
    advanced: 50,
    high: 75,
    pinnacle: 90,
  },
};

export function clampAreaLevel(value) {
  const level = Math.round(Number(value) || SCALING_CONFIG.enemy.levelMin);
  return Math.max(SCALING_CONFIG.enemy.levelMin, Math.min(SCALING_CONFIG.enemy.levelMax, level));
}

export function areaLevelBucketLabel(areaLevel) {
  const size = Math.max(1, Math.floor(SCALING_CONFIG.mapDrop.areaLevelBucketSize || 5));
  const min = Math.floor((clampAreaLevel(areaLevel) - 1) / size) * size + 1;
  const max = min + size - 1;
  return `${min}-${max}`;
}

export function enemyLifeMultiplier(areaLevel, config = SCALING_CONFIG) {
  const level = clampAreaLevel(areaLevel);
  const c = config.enemy;
  const x = level - (c.scalingPivotAreaLevel ?? 11);
  const curve = 1 + c.lifeLinear * x + c.lifeQuad * x * x;
  return Math.max(0.1, curve) * (c.baseLifeMultiplier ?? 1);
}

export function enemyDamageMultiplier(areaLevel, config = SCALING_CONFIG) {
  const level = clampAreaLevel(areaLevel);
  const c = config.enemy;
  const x = level - (c.scalingPivotAreaLevel ?? 11);
  const curve = 1 + c.damageLinear * x + c.damageQuad * x * x;
  return Math.max(0.1, curve) * (c.baseDamageMultiplier ?? 1);
}

export function enemyXpMultiplier(areaLevel, config = SCALING_CONFIG) {
  const level = clampAreaLevel(areaLevel);
  const c = config.enemy;
  const x = level - (c.scalingPivotAreaLevel ?? 11);
  const curve = 1 + c.xpLinear * x + c.xpQuad * x * x;
  return Math.max(0.1, curve) * (c.baseXpMultiplier ?? 1);
}

export function enemySpeedMultiplier(areaLevel, config = SCALING_CONFIG) {
  const level = clampAreaLevel(areaLevel);
  const c = config.enemy;
  return 1 + Math.min(c.speedCap, c.speedPerLevel * (level - 1));
}

export function enemyArmorPenMultiplier(areaLevel, config = SCALING_CONFIG) {
  const level = clampAreaLevel(areaLevel);
  const c = config.enemy;
  return 1 + Math.min(c.armorPenCap, c.armorPenPerLevel * (level - 1));
}

export function bossLifeMultiplier(areaLevel, config = SCALING_CONFIG) {
  return enemyLifeMultiplier(areaLevel, config) * config.boss.lifeMult;
}

export function bossDamageMultiplier(areaLevel, config = SCALING_CONFIG) {
  return enemyDamageMultiplier(areaLevel, config) * config.boss.damageMult;
}

export function bossMitigationMultiplier(areaLevel, config = SCALING_CONFIG) {
  const level = clampAreaLevel(areaLevel);
  return 1 + Math.min(config.boss.mitigationCap, config.boss.mitigationPerLevel * (level - 1));
}
