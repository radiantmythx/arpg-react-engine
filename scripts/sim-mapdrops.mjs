import { SCALING_CONFIG } from '../src/game/config/scalingConfig.js';
import { rollMapDropItemLevel } from '../src/game/data/mapItems.js';

const SAMPLE_DROPS = 20000;
const CLIMB_RUNS = 1000;
const CLIMB_MAX_DROPS = 180;
const CLIMB_START_LEVEL = 60;
const CLIMB_TARGET_LEVEL = 100;

function bump(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function sortedEntries(map) {
  return [...map.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
}

function runCampaignDistribution() {
  const deltaCounts = new Map();
  for (let i = 0; i < SAMPLE_DROPS; i += 1) {
    const roll = rollMapDropItemLevel({
      dropContext: 'campaign',
      areaLevel: 30,
      sourceTier: 3,
      playerLevel: 30,
    });
    bump(deltaCounts, roll.delta);
  }
  return deltaCounts;
}

function runInstanceDistribution() {
  const deltaCounts = new Map();
  const streakHistogram = new Map();
  const badLuckState = { negativeStreak: 0, protectionTriggers: 0, totalDrops: 0 };

  let pendingNegativeStreak = 0;
  for (let i = 0; i < SAMPLE_DROPS; i += 1) {
    const roll = rollMapDropItemLevel({
      dropContext: 'instance',
      sourceMapItemLevel: 60,
      sourceTier: 6,
      playerLevel: 60,
      badLuckState,
    });
    bump(deltaCounts, roll.delta);

    if (roll.delta < 0) {
      pendingNegativeStreak += 1;
    } else {
      bump(streakHistogram, pendingNegativeStreak);
      pendingNegativeStreak = 0;
    }
  }

  if (pendingNegativeStreak > 0) {
    bump(streakHistogram, pendingNegativeStreak);
  }

  return {
    deltaCounts,
    streakHistogram,
    badLuckState,
  };
}

function runClimbSimulation() {
  const dropsToTarget = [];
  const finalLevels = [];

  for (let run = 0; run < CLIMB_RUNS; run += 1) {
    const badLuckState = { negativeStreak: 0, protectionTriggers: 0, totalDrops: 0 };
    let current = CLIMB_START_LEVEL;
    let reachedAt = null;

    for (let dropIndex = 1; dropIndex <= CLIMB_MAX_DROPS; dropIndex += 1) {
      const roll = rollMapDropItemLevel({
        dropContext: 'instance',
        sourceMapItemLevel: current,
        sourceTier: Math.max(1, Math.ceil(current / 10)),
        playerLevel: current,
        badLuckState,
      });
      current = Math.max(current, roll.mapItemLevel);
      if (reachedAt == null && current >= CLIMB_TARGET_LEVEL) {
        reachedAt = dropIndex;
        break;
      }
    }

    finalLevels.push(current);
    if (reachedAt != null) {
      dropsToTarget.push(reachedAt);
    }
  }

  const avgFinalLevel = finalLevels.reduce((sum, x) => sum + x, 0) / Math.max(1, finalLevels.length);
  const successRate = dropsToTarget.length / CLIMB_RUNS;
  const avgDropsOnSuccess = dropsToTarget.length
    ? dropsToTarget.reduce((sum, x) => sum + x, 0) / dropsToTarget.length
    : null;

  return {
    avgFinalLevel,
    successRate,
    avgDropsOnSuccess,
  };
}

function printDistribution(label, map, sampleSize) {
  console.log(`\n${label}`);
  for (const [delta, count] of sortedEntries(map)) {
    const pct = (count / sampleSize) * 100;
    console.log(`  delta ${delta >= 0 ? '+' : ''}${delta}: ${count} (${pct.toFixed(2)}%)`);
  }
}

function main() {
  console.log('=== Map Drop Progression Simulation (Phase 4) ===');
  console.log(`Config version: ${SCALING_CONFIG.version}`);
  console.log(`Campaign variance: +/-${SCALING_CONFIG.mapDrop.campaignVariance}`);
  console.log(`Instance deltas: ${SCALING_CONFIG.mapDrop.instanceMinDelta}..${SCALING_CONFIG.mapDrop.instanceMaxDelta}`);
  console.log(`Bad-luck threshold: ${SCALING_CONFIG.mapDrop.badLuckThreshold}`);

  const campaignDist = runCampaignDistribution();
  printDistribution('Campaign delta distribution', campaignDist, SAMPLE_DROPS);

  const instance = runInstanceDistribution();
  printDistribution('Instance delta distribution', instance.deltaCounts, SAMPLE_DROPS);

  const avgStreak = sortedEntries(instance.streakHistogram)
    .reduce((sum, [streakLen, count]) => sum + Number(streakLen) * count, 0) / Math.max(1, [...instance.streakHistogram.values()].reduce((a, b) => a + b, 0));
  const maxObservedStreak = Math.max(...instance.streakHistogram.keys(), 0);
  const protectionFreq = (instance.badLuckState.protectionTriggers / Math.max(1, instance.badLuckState.totalDrops)) * 100;

  console.log('\nNon-negative streak behavior');
  console.log(`  average negative streak before recovery: ${avgStreak.toFixed(2)} drops`);
  console.log(`  max observed negative streak: ${maxObservedStreak}`);
  console.log(`  bad-luck protection trigger frequency: ${protectionFreq.toFixed(2)}%`);

  const climb = runClimbSimulation();
  console.log('\nClimb viability metrics');
  console.log(`  expected final iLvl after ${CLIMB_MAX_DROPS} drops: ${climb.avgFinalLevel.toFixed(2)}`);
  console.log(`  reach iLvl ${CLIMB_TARGET_LEVEL} within ${CLIMB_MAX_DROPS} drops: ${(climb.successRate * 100).toFixed(2)}% of runs`);
  if (climb.avgDropsOnSuccess != null) {
    console.log(`  average drops to target (successful runs): ${climb.avgDropsOnSuccess.toFixed(2)}`);
  }

  const unhealthy = climb.successRate < 0.75 || protectionFreq > 12;
  if (unhealthy) {
    console.log('\nSuggested first-pass SCALING_CONFIG tweaks:');
    console.log(`  - Increase SCALING_CONFIG.mapDrop.instanceWeights positive slots or raise center mass around delta +1/+2.`);
    console.log(`  - Lower SCALING_CONFIG.mapDrop.badLuckThreshold below ${SCALING_CONFIG.mapDrop.badLuckThreshold} if negative streaks remain long.`);
  } else {
    console.log('\nNo first-pass tuning change suggested; climb metrics look healthy in this sample.');
  }

  process.exitCode = 0;
}

main();
