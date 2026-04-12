#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const toFileUrl = (p) => new URL(`file:///${p.replace(/\\/g, '/')}`);

global.document = { createElement: () => ({ getContext: () => ({}) }) };
global.window = { devicePixelRatio: 1 };

const { MapGenerator } = await import(toFileUrl(path.join(projectRoot, 'src/game/MapGenerator.js')).href);
const { compileMapDefinitionToRuntime } = await import(toFileUrl(path.join(projectRoot, 'src/game/content/maps/mapCompiler.js')).href);
const { MIGRATED_MAP_DEFINITIONS } = await import(toFileUrl(path.join(projectRoot, 'src/game/content/maps/mapDefinitions.js')).href);
const { ClusterSpawner } = await import(toFileUrl(path.join(projectRoot, 'src/game/systems/ClusterSpawner.js')).href);

const SETPIECE_TYPES = [
  'shrine_room',
  'elite_ambush_room',
  'cursed_chest_pocket',
  'trap_antechamber',
  'vault_side_room',
  'boss_prelude_hall',
];

function formatPercent(fraction) {
  return `${(fraction * 100).toFixed(1)}%`;
}

function verifyNodeShape(node) {
  const errors = [];
  if (!node?.id || typeof node.id !== 'string') errors.push('missing id');
  if (!SETPIECE_TYPES.includes(node?.type)) errors.push(`invalid type: ${node?.type}`);
  if (!node?.roomId || typeof node.roomId !== 'string') errors.push('missing roomId');
  if (!['early', 'mid', 'late'].includes(node?.stage)) errors.push(`invalid stage: ${node?.stage}`);
  if (!Array.isArray(node?.tags)) errors.push('missing tags[]');
  if (typeof node?.centerTile?.tx !== 'number' || typeof node?.centerTile?.ty !== 'number') {
    errors.push('invalid centerTile');
  }
  if (typeof node?.bounds?.x !== 'number' || typeof node?.bounds?.y !== 'number') {
    errors.push('invalid bounds');
  }
  return errors;
}

function analyzeSpawnerTuning() {
  const spawner = new ClusterSpawner({});
  const baseline = spawner._deriveRoomEncounterTuning({ id: 'base', type: 'combat', w: 10, h: 10 }, []);

  const bySetpiece = {};
  for (const type of SETPIECE_TYPES) {
    bySetpiece[type] = spawner._deriveRoomEncounterTuning({ id: type, type: 'combat', w: 10, h: 10 }, [type]);
  }

  const finalThirdLate = spawner._deriveRoomEncounterTuning(
    { id: 'late', type: 'combat', w: 10, h: 10 },
    ['boss_approach_final_third', 'progress_stage_late'],
  );

  return { baseline, bySetpiece, finalThirdLate };
}

function analyzeSetpieceDistribution(generated) {
  const counts = Object.fromEntries(SETPIECE_TYPES.map((k) => [k, 0]));
  for (const sample of generated) {
    for (const node of sample.layout.encounterMetadata?.setpieceNodes ?? []) {
      if (counts[node.type] !== undefined) counts[node.type] += 1;
    }
  }
  return counts;
}

function verifyBossApproach(sample) {
  const errors = [];
  const encounter = sample.layout.encounterMetadata;
  const bossApproach = encounter?.bossApproach;

  if (!bossApproach) {
    errors.push('missing bossApproach');
    return errors;
  }

  const finalThird = bossApproach.finalThirdRoomIds ?? [];
  if (!Array.isArray(finalThird) || finalThird.length === 0) {
    errors.push('missing finalThirdRoomIds');
  }

  const roomIds = new Set((sample.layout.rooms ?? []).map((r) => r.id));
  for (const roomId of finalThird) {
    if (!roomIds.has(roomId)) errors.push(`final-third room not found: ${roomId}`);
  }

  const roomTagsById = encounter?.roomTagsById ?? {};
  for (const roomId of finalThird) {
    const tags = roomTagsById[roomId] ?? [];
    if (!tags.includes('boss_approach_final_third')) {
      errors.push(`final-third room missing tag: ${roomId}`);
      break;
    }
  }

  if (!Array.isArray(bossApproach.stageSequence) || bossApproach.stageSequence.length === 0) {
    errors.push('missing stageSequence');
  }

  return errors;
}

async function main() {
  console.log('\nPhase 8 Simulation: Encounter Setpieces and Boss-Approach Logic\n');

  const sampleSize = 20;
  const sourceDefs = MIGRATED_MAP_DEFINITIONS;
  const generated = [];

  for (let i = 0; i < sampleSize; i++) {
    const mapDef = sourceDefs[i % sourceDefs.length];
    const runtimeDef = compileMapDefinitionToRuntime(mapDef);
    const seed = ((Date.now() + i * 3571) >>> 0);
    const layout = MapGenerator.generate(runtimeDef, seed);
    generated.push({ mapId: mapDef.id, seed, layout });
  }

  console.log(`Generated maps: ${generated.length}`);

  let nodeShapeErrors = 0;
  let bossApproachErrorCount = 0;
  let mapsWithAllSetpieces = 0;
  let mapsWithAllStages = 0;
  let mapsWithFinalThirdTags = 0;

  for (const sample of generated) {
    const encounter = sample.layout.encounterMetadata;
    const nodes = encounter?.setpieceNodes ?? [];

    const types = new Set(nodes.map((n) => n.type));
    if (SETPIECE_TYPES.every((type) => types.has(type))) mapsWithAllSetpieces++;

    const stages = new Set(nodes.map((n) => n.stage));
    if (stages.has('early') && stages.has('mid') && stages.has('late')) mapsWithAllStages++;

    for (const node of nodes) {
      nodeShapeErrors += verifyNodeShape(node).length;
    }

    const finalThirdIds = encounter?.bossApproach?.finalThirdRoomIds ?? [];
    const roomTagsById = encounter?.roomTagsById ?? {};
    if (
      finalThirdIds.length > 0
      && finalThirdIds.every((roomId) => (roomTagsById[roomId] ?? []).includes('boss_approach_final_third'))
    ) {
      mapsWithFinalThirdTags++;
    }

    bossApproachErrorCount += verifyBossApproach(sample).length;
  }

  const setpieceDist = analyzeSetpieceDistribution(generated);
  const totalSetpieceNodes = Object.values(setpieceDist).reduce((a, b) => a + b, 0);

  console.log('\nVerification 1: Staged setpiece metadata');
  console.log(`Maps with all 6 setpieces: ${mapsWithAllSetpieces}/${generated.length}`);
  console.log(`Maps with early/mid/late staging: ${mapsWithAllStages}/${generated.length}`);
  console.log(`Setpiece node shape errors: ${nodeShapeErrors}`);

  console.log('\nVerification 2: Boss-approach final-third tags');
  console.log(`Maps with fully tagged final-third rooms: ${mapsWithFinalThirdTags}/${generated.length}`);
  console.log(`Boss-approach rule errors: ${bossApproachErrorCount}`);

  console.log('\nVerification 3: Setpiece-driven spawn adjustments');
  const tuning = analyzeSpawnerTuning();
  const packMults = Object.values(tuning.bySetpiece).map((v) => v.packMult);
  const minPack = Math.min(...packMults);
  const maxPack = Math.max(...packMults);
  const setpieceSpread = ((maxPack - minPack) / Math.max(0.0001, minPack)) * 100;
  const finalThirdDelta = ((tuning.finalThirdLate.packMult - tuning.baseline.packMult) / Math.max(0.0001, tuning.baseline.packMult)) * 100;
  console.log(`Setpiece pack-density spread: ${setpieceSpread.toFixed(1)}%`);
  console.log(`Final-third late-stage pack-density delta: ${finalThirdDelta.toFixed(1)}%`);

  console.log('\nSetpiece distribution:');
  for (const [type, count] of Object.entries(setpieceDist)) {
    const pct = totalSetpieceNodes > 0 ? formatPercent(count / totalSetpieceNodes) : '0.0%';
    console.log(`${type.padEnd(24)} ${String(count).padStart(3)} (${pct})`);
  }

  const passed = (
    mapsWithAllSetpieces === generated.length
    && mapsWithAllStages === generated.length
    && mapsWithFinalThirdTags === generated.length
    && nodeShapeErrors === 0
    && bossApproachErrorCount === 0
    && setpieceSpread > 0
    && finalThirdDelta > 0
  );

  console.log('\nSummary:');
  console.log(`Total setpiece nodes: ${totalSetpieceNodes}`);
  console.log(`Result: ${passed ? 'PASS' : 'FAIL'}`);

  process.exit(passed ? 0 : 1);
}

main().catch((error) => {
  console.error('Simulation failed:', error?.stack ?? error?.message ?? error);
  process.exit(1);
});