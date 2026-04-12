import { MapGenerator } from '../src/game/MapGenerator.js';
import { Navigation } from '../src/game/Navigation.js';

const baseDef = {
  id: 'phase9_base',
  layoutFamily: 'bsp_fortress',
  pathStyle: 'branching',
  theme: 'ruins',
  tier: 6,
  packsPerRoom: 2,
};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function terrainCount(map, terrainId) {
  const codeById = {
    mud: 1,
    shallow_water: 2,
    ash: 3,
    brambles: 4,
    cracked_ice: 5,
  };
  const code = codeById[terrainId];
  let c = 0;
  for (let i = 0; i < map.terrainMask.length; i++) {
    if (map.terrainMask[i] === code) c++;
  }
  return c;
}

const seed = 991177;
const baseline = MapGenerator.generate(baseDef, seed);
const baselineObstacleCount = baseline.obstacles.length;
const baselineWater = terrainCount(baseline, 'shallow_water');
const baselineBrambles = terrainCount(baseline, 'brambles');
const baselineCorridorMax = Math.max(...(baseline.corridorWidths ?? [1]));

const modCases = [
  { id: 'twisting', mods: [{ id: 'twisting', value: 1 }] },
  { id: 'fortified', mods: [{ id: 'fortified', value: 1 }] },
  { id: 'flooded', mods: [{ id: 'flooded', value: 1 }] },
  { id: 'overgrown', mods: [{ id: 'overgrown', value: 1 }] },
  { id: 'volatile', mods: [{ id: 'volatile', value: 1 }] },
  { id: 'corrupted', mods: [{ id: 'corrupted', value: 1 }] },
];

for (const mc of modCases) {
  const map = MapGenerator.generate({ ...baseDef, id: `phase9_${mc.id}`, mods: mc.mods }, seed);

  assert(map.mapModMetadata?.activeModIds?.includes(mc.id), `${mc.id}: missing active mod id metadata`);
  assert(Array.isArray(map.mapModMetadata?.notes) && map.mapModMetadata.notes.length > 0, `${mc.id}: missing mod notes`);

  const nav = Navigation.buildCache(map);
  assert(nav && nav.walkable.length === map.cols * map.rows, `${mc.id}: navigation cache invalid`);
  assert(map.startRoom && map.bossRoom, `${mc.id}: missing start or boss room`);
  assert(!map.isWall(map.startRoom.centerX, map.startRoom.centerY), `${mc.id}: blocked start room center`);
  assert(!map.isWall(map.bossRoom.centerX, map.bossRoom.centerY), `${mc.id}: blocked boss room center`);
  assert(Array.isArray(map.floorTiles) && map.floorTiles.length > 120, `${mc.id}: floor pool too small`);

  for (let i = 0; i < Math.min(80, map.floorTiles.length); i++) {
    const ft = map.floorTiles[i];
    assert(!map.isWall(ft.tx, ft.ty), `${mc.id}: blocked floor tile candidate`);
    const speedMult = map.terrainSpeedMultiplierAtTile(ft.tx, ft.ty);
    assert(speedMult >= 0.915, `${mc.id}: spawn-safe floor tile in heavy terrain`);
  }

  if (mc.id === 'twisting') {
    const modCorridorMax = Math.max(...(map.corridorWidths ?? [1]));
    assert(modCorridorMax <= Math.max(2, baselineCorridorMax), 'twisting: corridor modulation did not apply');
  }
  if (mc.id === 'fortified') {
    assert(map.obstacles.length > baselineObstacleCount, 'fortified: obstacle density did not increase');
  }
  if (mc.id === 'flooded') {
    assert(terrainCount(map, 'shallow_water') > baselineWater, 'flooded: shallow-water coverage did not increase');
  }
  if (mc.id === 'overgrown') {
    assert(terrainCount(map, 'brambles') > baselineBrambles, 'overgrown: bramble coverage did not increase');
  }
  if (mc.id === 'volatile') {
    assert(map.encounterMetadata?.hazardProfile === 'volatile', 'volatile: hazard profile missing');
    const volatileNodes = (map.encounterMetadata?.setpieceNodes ?? []).filter((n) => n.tags?.includes('volatile'));
    assert(volatileNodes.length > 0, 'volatile: setpiece volatile tags missing');
  }
  if (mc.id === 'corrupted') {
    const overlays = map.mapModMetadata?.postGeneration?.visualOverlays ?? [];
    assert(overlays.includes('corrupted_veil'), 'corrupted: missing veil overlay metadata');
    assert(typeof map.mapModMetadata?.bossArenaCorruptionVariant === 'string', 'corrupted: missing boss arena corruption variant');
    assert(map.bossRoom?.corruptionVariant === map.mapModMetadata?.bossArenaCorruptionVariant, 'corrupted: boss room variant mismatch');
    assert(map.encounterMetadata?.hazardProfile === 'corrupted', 'corrupted: hazard profile missing');

    const finalThirdRoomIds = map.encounterMetadata?.bossApproach?.finalThirdRoomIds ?? [];
    assert(finalThirdRoomIds.length > 0, 'corrupted: expected final-third traversal rooms');
    const taggedFinalThird = finalThirdRoomIds.filter((roomId) => (map.encounterMetadata?.roomTagsById?.[roomId] ?? []).includes('corrupted_zone'));
    assert(taggedFinalThird.length > 0, 'corrupted: final-third corruption tags missing');
  }
}

const hybrid = MapGenerator.generate(
  {
    ...baseDef,
    id: 'phase9_hybrid',
    mods: [{ id: 'twisting', value: 1 }, { id: 'flooded', value: 1 }],
  },
  seed,
);
assert(hybrid.layoutFamily === 'bsp_fortress', 'hybrid: base family changed unexpectedly');
assert(hybrid.mapModMetadata?.hybridRemix?.enabled === true, 'hybrid: remix metadata missing');
assert(typeof hybrid.mapModMetadata?.hybridRemix?.hintFamily === 'string', 'hybrid: remix hint missing');

console.log('Phase 9 map-mod sanity OK');
