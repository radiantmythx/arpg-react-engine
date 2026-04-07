import { getEnemyById, getFreeMapById } from '../src/game/content/registries/index.js';

const MAP_IDS = ['act1_fallen_cloister', 'act2_scorched_foothills'];

function summarizeMap(id) {
  const mapDef = getFreeMapById(id);
  if (!mapDef) {
    throw new Error(`Missing map '${id}'`);
  }

  const enemyEntries = Array.isArray(mapDef.enemyPool) ? mapDef.enemyPool : [];
  if (enemyEntries.length === 0) {
    throw new Error(`Map '${id}' has empty enemy pool`);
  }

  const enemies = enemyEntries.map((entry) => {
    const enemyId = typeof entry === 'string' ? entry : entry?.id;
    const weight = typeof entry === 'string' ? 1 : Number(entry?.weight ?? 1);
    const enemy = getEnemyById(enemyId);
    if (!enemy) {
      throw new Error(`Map '${id}' references missing enemy '${enemyId}'`);
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error(`Map '${id}' has invalid enemy weight '${weight}' for '${enemyId}'`);
    }
    return { enemy, weight };
  });

  const totalWeight = enemies.reduce((sum, row) => sum + row.weight, 0);
  const avgHealth = enemies.reduce((sum, row) => sum + row.enemy.health * row.weight, 0) / totalWeight;
  const avgDamage = enemies.reduce((sum, row) => sum + row.enemy.damage * row.weight, 0) / totalWeight;
  const pressure = avgHealth * avgDamage * mapDef.packsPerRoom * mapDef.difficulty;
  const xpMult = Number(mapDef.rewards?.xpMult ?? 0);
  const itemLevel = Number(mapDef.rewards?.itemLevel ?? 0);

  if (!Number.isFinite(mapDef.difficulty) || mapDef.difficulty <= 0) {
    throw new Error(`Map '${id}' has invalid difficulty '${mapDef.difficulty}'`);
  }
  if (!Number.isFinite(xpMult) || xpMult <= 0) {
    throw new Error(`Map '${id}' has invalid xpMult '${xpMult}'`);
  }
  if (!Number.isFinite(itemLevel) || itemLevel <= 0) {
    throw new Error(`Map '${id}' has invalid itemLevel '${itemLevel}'`);
  }

  return {
    id,
    difficulty: mapDef.difficulty,
    xpMult,
    itemLevel,
    avgHealth,
    avgDamage,
    pressure,
  };
}

function run() {
  const rows = MAP_IDS.map(summarizeMap);
  if (rows[1].pressure <= rows[0].pressure) {
    throw new Error('Encounter pressure should increase from act1_fallen_cloister to act2_scorched_foothills');
  }
  if (rows[1].xpMult < rows[0].xpMult) {
    throw new Error('Map reward xpMult regressed between migrated maps');
  }

  console.log('Encounter simulation passed.');
  for (const row of rows) {
    console.log(`- ${row.id}: difficulty=${row.difficulty.toFixed(2)}, xpMult=${row.xpMult.toFixed(2)}, itemLevel=${row.itemLevel}, pressure=${row.pressure.toFixed(2)}`);
  }
}

run();
