import {
  SCALING_CONFIG,
  clampAreaLevel,
  enemyLifeMultiplier,
  enemyDamageMultiplier,
  enemySpeedMultiplier,
  bossLifeMultiplier,
  bossDamageMultiplier,
} from '../src/game/config/scalingConfig.js';

function round(value, digits = 4) {
  const pow = 10 ** digits;
  return Math.round(value * pow) / pow;
}

function bucketRange(start, size) {
  return {
    min: start,
    max: Math.min(SCALING_CONFIG.enemy.levelMax, start + size - 1),
  };
}

function runLevelSweep() {
  const levels = [];
  for (let level = SCALING_CONFIG.enemy.levelMin; level <= SCALING_CONFIG.enemy.levelMax; level++) {
    const life = enemyLifeMultiplier(level);
    const damage = enemyDamageMultiplier(level);
    const speed = enemySpeedMultiplier(level);

    // Encounter proxy assumptions for trend checks.
    const baseEnemyHp = 120;
    const baseEnemyDps = 28;
    const playerDps = 155;
    const playerEhp = 720;

    const enemyEffectiveHp = baseEnemyHp * life;
    const ttkSeconds = enemyEffectiveHp / playerDps;
    const incomingDps = baseEnemyDps * damage * speed;
    const expectedDamageTaken = incomingDps * ttkSeconds;
    const deathsProxy = expectedDamageTaken / playerEhp;

    levels.push({
      level,
      enemyLifeMult: life,
      enemyDamageMult: damage,
      enemySpeedMult: speed,
      bossLifeMult: bossLifeMultiplier(level),
      bossDamageMult: bossDamageMultiplier(level),
      durabilitySeconds: ttkSeconds,
      deathsProxy,
    });
  }
  return levels;
}

function monotonicCheck(series, key) {
  let prev = Number.NEGATIVE_INFINITY;
  const spikes = [];
  for (const point of series) {
    const value = point[key];
    if (value + 1e-12 < prev) {
      spikes.push({ level: point.level, previous: prev, current: value });
    }
    prev = value;
  }
  return {
    key,
    pass: spikes.length === 0,
    spikes,
  };
}

function buildBuckets(levelSeries) {
  const size = Math.max(1, Math.floor(SCALING_CONFIG.mapDrop.areaLevelBucketSize || 5));
  const buckets = [];
  for (let start = SCALING_CONFIG.enemy.levelMin; start <= SCALING_CONFIG.enemy.levelMax; start += size) {
    const range = bucketRange(start, size);
    const points = levelSeries.filter((row) => row.level >= range.min && row.level <= range.max);
    if (!points.length) continue;

    const avg = (k) => points.reduce((acc, item) => acc + item[k], 0) / points.length;
    buckets.push({
      label: `${range.min}-${range.max}`,
      count: points.length,
      avgEnemyLifeMult: avg('enemyLifeMult'),
      avgEnemyDamageMult: avg('enemyDamageMult'),
      avgDurabilitySeconds: avg('durabilitySeconds'),
      avgDeathsProxy: avg('deathsProxy'),
    });
  }
  return buckets;
}

function suggestTweaks(checks) {
  const suggestions = [];

  const lifeCheck = checks.find((c) => c.key === 'durabilitySeconds');
  if (lifeCheck && !lifeCheck.pass) {
    suggestions.push({
      key: 'SCALING_CONFIG.enemy.lifeQuad',
      from: SCALING_CONFIG.enemy.lifeQuad,
      to: round(SCALING_CONFIG.enemy.lifeQuad * 0.92, 6),
      reason: 'Reduce late-level durability spikes by lowering quadratic life growth.',
    });
  }

  const deathsCheck = checks.find((c) => c.key === 'deathsProxy');
  if (deathsCheck && !deathsCheck.pass) {
    suggestions.push({
      key: 'SCALING_CONFIG.enemy.dmgQuad',
      from: SCALING_CONFIG.enemy.dmgQuad,
      to: round(SCALING_CONFIG.enemy.dmgQuad * 0.9, 6),
      reason: 'Smooth non-monotonic incoming-pressure behavior by reducing quadratic damage growth.',
    });
  }

  return suggestions;
}

function printReport(levelSeries, buckets, checks, suggestions) {
  console.log('=== Scaling Simulation (Phase 2) ===');
  console.log(`Config version: ${SCALING_CONFIG.version}`);
  console.log(`Levels: ${SCALING_CONFIG.enemy.levelMin}-${SCALING_CONFIG.enemy.levelMax}`);
  console.log(`Bucket size: ${SCALING_CONFIG.mapDrop.areaLevelBucketSize}`);
  console.log('');

  console.log('Bucket summary:');
  for (const bucket of buckets) {
    console.log(
      `  L${bucket.label} | life=${round(bucket.avgEnemyLifeMult, 3)}x dmg=${round(bucket.avgEnemyDamageMult, 3)}x `
      + `dur=${round(bucket.avgDurabilitySeconds, 3)}s deathsProxy=${round(bucket.avgDeathsProxy, 4)}`,
    );
  }
  console.log('');

  console.log('Monotonic checks:');
  for (const check of checks) {
    if (check.pass) {
      console.log(`  PASS ${check.key}`);
      continue;
    }
    console.log(`  FAIL ${check.key} (${check.spikes.length} spikes)`);
    for (const spike of check.spikes.slice(0, 5)) {
      console.log(
        `    level ${spike.level}: prev=${round(spike.previous, 5)} current=${round(spike.current, 5)}`,
      );
    }
  }
  console.log('');

  if (!suggestions.length) {
    console.log('No coefficient tweaks suggested. Curves are monotonic with current assumptions.');
    return;
  }

  console.log('Suggested SCALING_CONFIG-only tweaks:');
  for (const suggestion of suggestions) {
    console.log(
      `  ${suggestion.key}: ${suggestion.from} -> ${suggestion.to} (${suggestion.reason})`,
    );
  }
}

function main() {
  const levelSeries = runLevelSweep();
  const buckets = buildBuckets(levelSeries);

  const checks = [
    monotonicCheck(levelSeries, 'enemyLifeMult'),
    monotonicCheck(levelSeries, 'enemyDamageMult'),
    monotonicCheck(levelSeries, 'durabilitySeconds'),
    monotonicCheck(levelSeries, 'deathsProxy'),
  ];

  const suggestions = suggestTweaks(checks);
  printReport(levelSeries, buckets, checks, suggestions);

  const failures = checks.filter((c) => !c.pass).length;
  process.exitCode = failures ? 2 : 0;
}

main();
