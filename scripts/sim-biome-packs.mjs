import {
  BIOME_PACKS,
  ACT_BIOME_PACKS,
  ENDGAME_BIOME_PACKS,
  biomePackSupportsAct,
  biomePackSupportsEndgame,
} from '../src/game/content/maps/index.js';
import { listFreeMaps } from '../src/game/content/registries/index.js';
import { createMapItemDrop } from '../src/game/data/mapItems.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countByStage(packs) {
  const counts = { act: 0, endgame: 0, both: 0 };
  for (const p of packs) {
    counts[p.contentStage] = (counts[p.contentStage] ?? 0) + 1;
  }
  return counts;
}

function verifyCampaignPacks() {
  const freeMaps = listFreeMaps();
  for (const map of freeMaps) {
    if (!map.biomePackId) continue;
    const pack = BIOME_PACKS.find((p) => p.id === map.biomePackId);
    assert(!!pack, `map ${map.id} references missing biome pack ${map.biomePackId}`);
    assert(biomePackSupportsAct(pack), `map ${map.id} uses non-act biome pack ${pack.id}`);
  }
  console.log(`Campaign maps checked: ${freeMaps.length}`);
}

function verifyEndgameDrops(sampleSize = 500) {
  const seen = new Map();
  for (let i = 0; i < sampleSize; i += 1) {
    const mapItem = createMapItemDrop(8, 82, false, { dropContext: 'instance', sourceMapItemLevel: 82 });
    const id = mapItem.mapBiomePackId;
    const stage = mapItem.mapBiomeContentStage;
    assert(!!id, 'endgame map drop missing biome pack id');
    assert(stage === 'endgame' || stage === 'both', `endgame map drop has invalid stage ${stage} (${id})`);
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  console.log(`Endgame drop biome packs sampled (${sampleSize}):`);
  for (const [id, count] of [...seen.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${id}: ${count}`);
  }
}

function main() {
  console.log('=== Biome Pack Simulation (Phase 7) ===');

  const stageCounts = countByStage(BIOME_PACKS);
  console.log(`Biome packs total: ${BIOME_PACKS.length}`);
  console.log(`  act=${stageCounts.act} endgame=${stageCounts.endgame} both=${stageCounts.both}`);
  console.log(`Derived pools: act=${ACT_BIOME_PACKS.length} endgame=${ENDGAME_BIOME_PACKS.length}`);

  assert(ACT_BIOME_PACKS.length > 0, 'ACT_BIOME_PACKS must be non-empty');
  assert(ENDGAME_BIOME_PACKS.length > 0, 'ENDGAME_BIOME_PACKS must be non-empty');

  verifyCampaignPacks();
  verifyEndgameDrops();

  console.log('Biome pack simulation passed.');
}

main();
