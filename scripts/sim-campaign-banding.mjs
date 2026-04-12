import { SCALING_CONFIG } from '../src/game/config/scalingConfig.js';
import {
  buildCampaignPartProgression,
  inferCampaignProgress,
  resolveCampaignAreaLevel,
} from '../src/game/content/maps/campaignAreaLevel.js';
import { listFreeMaps } from '../src/game/content/registries/mapRegistry.js';

function formatDelta(delta) {
  if (delta == null) return 'n/a';
  return `${delta >= 0 ? '+' : ''}${delta}`;
}

function withinDelta(delta) {
  const min = SCALING_CONFIG.campaign.zoneExitDeltaMin;
  const max = SCALING_CONFIG.campaign.zoneExitDeltaMax;
  return delta >= min && delta <= max;
}

function globalStepIndex(row) {
  const actBand = SCALING_CONFIG.actBands.find((entry) => entry.act === row.act);
  const partsPerAct = actBand?.parts?.length ?? 1;
  return (row.act - 1) * partsPerAct + row.partIndex;
}

function withinDeltaForStepGap(delta, stepGap = 1) {
  const min = SCALING_CONFIG.campaign.zoneExitDeltaMin * stepGap;
  const max = SCALING_CONFIG.campaign.zoneExitDeltaMax * stepGap;
  return delta >= min && delta <= max;
}

function printProgression(title, rows) {
  console.log(`\n=== ${title} ===`);
  console.log('act step zone areaLevel delta transition');

  let prev = null;
  let failures = 0;
  for (const row of rows) {
    const delta = prev ? row.areaLevel - prev.areaLevel : null;
    const stepGap = prev ? Math.max(1, globalStepIndex(row) - globalStepIndex(prev)) : 1;
    const pass = delta == null
      ? true
      : (stepGap === 1 ? withinDelta(delta) : withinDeltaForStepGap(delta, stepGap));
    if (!pass) failures += 1;

    const stepLabel = row.partIndex != null ? `part${row.partIndex}` : `map${row.mapIndex}`;
    console.log(
      `${row.act.toString().padStart(3)} ${stepLabel.padStart(5)} ${row.zoneId.padEnd(28)} ${row.areaLevel
        .toString()
        .padStart(9)} ${formatDelta(delta).padStart(5)} ${pass ? 'PASS' : 'FAIL'}`,
    );

    prev = row;
  }

  console.log(`Transition checks: ${failures ? `FAIL (${failures})` : 'PASS (0 failures)'}`);
  return failures;
}

function buildMapRows() {
  const maps = listFreeMaps();
  return maps.map((map, index) => {
    const progress = inferCampaignProgress(map);
    return {
      mapIndex: index + 1,
      act: progress.act,
      partIndex: progress.partIndex,
      zoneId: progress.zoneId,
      areaLevel: resolveCampaignAreaLevel(progress),
    };
  });
}

function main() {
  console.log('=== Campaign Banding Simulation (Phase 3) ===');
  console.log(`Config version: ${SCALING_CONFIG.version}`);
  console.log(`Delta bounds: ${SCALING_CONFIG.campaign.zoneExitDeltaMin}-${SCALING_CONFIG.campaign.zoneExitDeltaMax}`);

  const partRows = buildCampaignPartProgression();
  const mapRows = buildMapRows();

  const partFailures = printProgression('Act Band Parts (authoritative progression)', partRows);
  const mapFailures = printProgression('Registered Campaign Maps (current content)', mapRows);

  const totalFailures = partFailures + mapFailures;
  process.exitCode = totalFailures ? 2 : 0;
}

main();
