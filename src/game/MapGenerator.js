import { TILE_SIZE } from './config.js';

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick(rng, values) {
  return values[Math.floor(rng() * values.length)];
}

function keyOf(tx, ty, cols) {
  return ty * cols + tx;
}

function carveRect(tiles, rows, cols, x, y, w, h, value = 0) {
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      if (ty >= 0 && ty < rows && tx >= 0 && tx < cols) tiles[ty][tx] = value;
    }
  }
}

function carveRow(tiles, rows, cols, x, y, w) {
  carveRect(tiles, rows, cols, x, y, w, 1, 0);
}

function carveCol(tiles, rows, cols, x, y, h) {
  carveRect(tiles, rows, cols, x, y, 1, h, 0);
}

function chooseRoomShape(leaf, rng, options = null) {
  if (Array.isArray(options?.forceRoomShapePool) && options.forceRoomShapePool.length > 0) {
    return pick(rng, options.forceRoomShapePool);
  }
  const aspect = leaf.w / Math.max(1, leaf.h);
  if (aspect > 1.6 || aspect < 0.625) return rng() < 0.5 ? 'hall' : 'offset';
  return pick(rng, ['rect', 'clipped', 'pill', 'offset', 'courtyard']);
}

function createRoomForLeaf(leaf, rng, options = null) {
  const shape = chooseRoomShape(leaf, rng, options);
  const hallHorizontal = leaf.w >= leaf.h;

  let roomW;
  let roomH;
  if (shape === 'hall') {
    if (hallHorizontal) {
      roomW = randInt(rng, Math.max(8, Math.floor(leaf.w * 0.62)), Math.max(8, leaf.w - 2));
      roomH = randInt(rng, 5, Math.max(5, Math.min(8, leaf.h - 2)));
    } else {
      roomW = randInt(rng, 5, Math.max(5, Math.min(8, leaf.w - 2)));
      roomH = randInt(rng, Math.max(8, Math.floor(leaf.h * 0.62)), Math.max(8, leaf.h - 2));
    }
  } else {
    roomW = randInt(rng, 6, Math.max(6, leaf.w - 2));
    roomH = randInt(rng, 6, Math.max(6, leaf.h - 2));
  }

  roomW = Math.max(5, Math.min(roomW, leaf.w - 2));
  roomH = Math.max(5, Math.min(roomH, leaf.h - 2));

  const roomX = randInt(rng, leaf.x + 1, leaf.x + leaf.w - roomW - 1);
  const roomY = randInt(rng, leaf.y + 1, leaf.y + leaf.h - roomH - 1);
  return { x: roomX, y: roomY, w: roomW, h: roomH, shape };
}

function carveRoomShape(tiles, rows, cols, room, rng) {
  const { x, y, w, h, shape } = room;

  if (shape === 'rect' || shape === 'hall') {
    carveRect(tiles, rows, cols, x, y, w, h);
    return;
  }

  if (shape === 'clipped') {
    carveRect(tiles, rows, cols, x, y, w, h);
    tiles[y][x] = 1;
    tiles[y][x + w - 1] = 1;
    tiles[y + h - 1][x] = 1;
    tiles[y + h - 1][x + w - 1] = 1;
    if (w >= 8 && h >= 8) {
      tiles[y + 1][x] = 1;
      tiles[y][x + 1] = 1;
      tiles[y + 1][x + w - 1] = 1;
      tiles[y][x + w - 2] = 1;
      tiles[y + h - 2][x] = 1;
      tiles[y + h - 1][x + 1] = 1;
      tiles[y + h - 2][x + w - 1] = 1;
      tiles[y + h - 1][x + w - 2] = 1;
    }
    return;
  }

  if (shape === 'pill') {
    carveRect(tiles, rows, cols, x + 1, y, Math.max(1, w - 2), h);
    carveRect(tiles, rows, cols, x, y + 1, w, Math.max(1, h - 2));
    return;
  }

  if (shape === 'offset') {
    const splitVertical = w >= h;
    if (splitVertical) {
      const leftW = Math.max(4, Math.floor(w * 0.58));
      carveRect(tiles, rows, cols, x, y, leftW, h);
      carveRect(tiles, rows, cols, x + Math.max(1, Math.floor(w * 0.28)), y + 1, w - Math.max(1, Math.floor(w * 0.28)), Math.max(3, h - 2));
    } else {
      const topH = Math.max(4, Math.floor(h * 0.58));
      carveRect(tiles, rows, cols, x, y, w, topH);
      carveRect(tiles, rows, cols, x + 1, y + Math.max(1, Math.floor(h * 0.28)), Math.max(3, w - 2), h - Math.max(1, Math.floor(h * 0.28)));
    }
    return;
  }

  if (shape === 'courtyard') {
    carveRect(tiles, rows, cols, x, y, w, h);
    const innerW = Math.max(2, w - 4);
    const innerH = Math.max(2, h - 4);
    if (innerW >= 2 && innerH >= 2) {
      carveRect(tiles, rows, cols, x + 2, y + 2, innerW, innerH, 1);
      if (rng() < 0.5) {
        carveRect(tiles, rows, cols, x + Math.floor(w / 2) - 1, y, 2, 2);
        carveRect(tiles, rows, cols, x + Math.floor(w / 2) - 1, y + h - 2, 2, 2);
      } else {
        carveRect(tiles, rows, cols, x, y + Math.floor(h / 2) - 1, 2, 2);
        carveRect(tiles, rows, cols, x + w - 2, y + Math.floor(h / 2) - 1, 2, 2);
      }
    }
  }
}

function carveCorridor(tiles, rows, cols, ax, ay, bx, by, width, rng) {
  const lane = Math.max(1, width);
  const half = Math.floor(lane / 2);
  const mouth = Math.max(1, lane);
  const carveH = (x1, x2, y) => carveRect(tiles, rows, cols, Math.min(x1, x2), y - half, Math.abs(x2 - x1) + 1, lane);
  const carveV = (x, y1, y2) => carveRect(tiles, rows, cols, x - half, Math.min(y1, y2), lane, Math.abs(y2 - y1) + 1);

  if (rng() > 0.5) {
    carveH(ax, bx, ay);
    carveV(bx, ay, by);
  } else {
    carveV(ax, ay, by);
    carveH(ax, bx, by);
  }

  carveRect(tiles, rows, cols, ax - mouth, ay - mouth, mouth * 2 + 1, mouth * 2 + 1);
  carveRect(tiles, rows, cols, bx - mouth, by - mouth, mouth * 2 + 1, mouth * 2 + 1);
}

function buildTypedRooms(rooms, startRoomBase, bossRoomBase, rng) {
  return rooms.map((room, idx) => ({
    id: `room_${idx}`,
    x: room.x,
    y: room.y,
    w: room.w,
    h: room.h,
    centerX: room.x + Math.floor(room.w / 2),
    centerY: room.y + Math.floor(room.h / 2),
    roomShape: room.shape,
    bossArenaStyle: null,
    type:
      room === startRoomBase
        ? 'start'
        : room === bossRoomBase
          ? 'boss'
          : rng() < 0.14
            ? 'elite'
            : rng() < 0.16
              ? 'treasure'
              : 'combat',
  }));
}

function reserveTile(reserved, tx, ty, cols, rows) {
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return;
  reserved.add(keyOf(tx, ty, cols));
}

function reserveArea(reserved, room, cols, rows, radius = 1) {
  for (let ty = room.centerY - radius; ty <= room.centerY + radius; ty++) {
    for (let tx = room.centerX - radius; tx <= room.centerX + radius; tx++) {
      reserveTile(reserved, tx, ty, cols, rows);
    }
  }
}

const OBSTACLE_CATEGORY = {
  LOS_BLOCKER: 'line_of_sight_blocker',
  COLLISION_BLOCKER: 'collision_blocker',
  DECORATIVE: 'decorative_non_collision',
  BOSS_PROP: 'boss_arena_prop',
};

const OBSTACLE_TYPE_DEFS = {
  pillar: {
    category: OBSTACLE_CATEGORY.LOS_BLOCKER,
    collision: true,
    blocksLineOfSight: true,
    radiusTiles: 0.4,
  },
  rubble: {
    category: OBSTACLE_CATEGORY.COLLISION_BLOCKER,
    collision: true,
    blocksLineOfSight: true,
    radiusTiles: 0.55,
  },
  fence: {
    category: OBSTACLE_CATEGORY.LOS_BLOCKER,
    collision: true,
    blocksLineOfSight: true,
    radiusTiles: 0.5,
  },
  altar: {
    category: OBSTACLE_CATEGORY.BOSS_PROP,
    collision: true,
    blocksLineOfSight: true,
    radiusTiles: 0.46,
  },
  torch: {
    category: OBSTACLE_CATEGORY.DECORATIVE,
    collision: false,
    blocksLineOfSight: false,
    radiusTiles: 0.24,
  },
  banner: {
    category: OBSTACLE_CATEGORY.DECORATIVE,
    collision: false,
    blocksLineOfSight: false,
    radiusTiles: 0.32,
  },
};

const TERRAIN_CODE = {
  NONE: 0,
  MUD: 1,
  SHALLOW_WATER: 2,
  ASH: 3,
  BRAMBLES: 4,
  CRACKED_ICE: 5,
};

const TERRAIN_DEFS = {
  [TERRAIN_CODE.MUD]: {
    id: 'mud',
    speedMult: 0.94,
    spawnRestricted: false,
  },
  [TERRAIN_CODE.SHALLOW_WATER]: {
    id: 'shallow_water',
    speedMult: 0.91,
    spawnRestricted: true,
  },
  [TERRAIN_CODE.ASH]: {
    id: 'ash',
    speedMult: 0.96,
    spawnRestricted: false,
  },
  [TERRAIN_CODE.BRAMBLES]: {
    id: 'brambles',
    speedMult: 0.92,
    spawnRestricted: true,
  },
  [TERRAIN_CODE.CRACKED_ICE]: {
    id: 'cracked_ice',
    speedMult: 0.98,
    spawnRestricted: false,
  },
};

const TERRAIN_BY_ID = Object.fromEntries(
  Object.entries(TERRAIN_DEFS).map(([code, def]) => [def.id, { code: Number(code), ...def }]),
);

function resolveObstacleSpec(type, renderHint = {}) {
  const base = OBSTACLE_TYPE_DEFS[type] ?? {
    category: OBSTACLE_CATEGORY.COLLISION_BLOCKER,
    collision: true,
    blocksLineOfSight: true,
    radiusTiles: 0.45,
  };
  return {
    category: renderHint.category ?? base.category,
    collision: renderHint.collision ?? base.collision,
    blocksLineOfSight: renderHint.blocksLineOfSight ?? base.blocksLineOfSight,
    radiusTiles: renderHint.radiusTiles ?? base.radiusTiles,
  };
}

function canPlaceObstacleFootprint(collisionMask, occupancyMask, tiles, cols, rows, footprint, reserved) {
  for (const { tx, ty } of footprint) {
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return false;
    if (tiles[ty][tx] !== 0) return false;
    if (occupancyMask[keyOf(tx, ty, cols)]) return false;
    if (collisionMask[keyOf(tx, ty, cols)]) return false;
    if (reserved.has(keyOf(tx, ty, cols))) return false;
  }
  return true;
}

function placeObstacle(obstacles, obstacleMask, obstacleOccupancyMask, tiles, cols, rows, room, type, footprint, renderHint = {}) {
  if (!canPlaceObstacleFootprint(obstacleMask, obstacleOccupancyMask, tiles, cols, rows, footprint, renderHint.reserved ?? new Set())) return false;
  const spec = resolveObstacleSpec(type, renderHint);
  for (const { tx, ty } of footprint) {
    obstacleOccupancyMask[keyOf(tx, ty, cols)] = 1;
    if (spec.collision) {
      obstacleMask[keyOf(tx, ty, cols)] = 1;
    }
  }
  const avgX = footprint.reduce((sum, tile) => sum + tile.tx, 0) / footprint.length;
  const avgY = footprint.reduce((sum, tile) => sum + tile.ty, 0) / footprint.length;
  const { reserved, ...renderHintMeta } = renderHint;
  obstacles.push({
    id: `${room.id}_${type}_${obstacles.length}`,
    roomId: room.id,
    type,
    category: spec.category,
    collision: spec.collision,
    blocksLineOfSight: spec.blocksLineOfSight,
    tiles: footprint,
    footprint: footprint,
    footprintType: footprint.length > 1 ? 'multi_tile' : 'single_tile',
    centerX: avgX,
    centerY: avgY,
    radiusTiles: spec.radiusTiles,
    renderHint: renderHintMeta,
    ...renderHintMeta,
  });
  return true;
}

function makeFootprint(originX, originY, pattern) {
  return pattern.map(([ox, oy]) => ({ tx: originX + ox, ty: originY + oy }));
}

function canPaintTerrainTile(tx, ty, cols, rows, tiles, obstacleOccupancyMask, reserved) {
  if (tx <= 0 || ty <= 0 || tx >= cols - 1 || ty >= rows - 1) return false;
  if (tiles[ty][tx] !== 0) return false;
  if (obstacleOccupancyMask[keyOf(tx, ty, cols)] === 1) return false;
  if (reserved?.has(keyOf(tx, ty, cols))) return false;
  return true;
}

function paintTerrainBlob(terrainMask, terrainCode, cx, cy, radius, cols, rows, tiles, obstacleOccupancyMask, reserved) {
  const r = Math.max(1.5, radius);
  const rSq = r * r;
  const minX = Math.floor(cx - r);
  const maxX = Math.ceil(cx + r);
  const minY = Math.floor(cy - r);
  const maxY = Math.ceil(cy + r);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (!canPaintTerrainTile(tx, ty, cols, rows, tiles, obstacleOccupancyMask, reserved)) continue;
      const dx = tx - cx;
      const dy = ty - cy;
      if (dx * dx + dy * dy <= rSq) {
        terrainMask[keyOf(tx, ty, cols)] = terrainCode;
      }
    }
  }
}

function seedSoftTerrain(typedRooms, tiles, cols, rows, rng, obstacleOccupancyMask, mapDef, terrainOptions = null) {
  const terrainMask = new Uint8Array(cols * rows);
  const reserved = new Set();
  for (const room of typedRooms) {
    const reserveRadius = room.type === 'boss' ? 3 : room.type === 'start' ? 2 : 1;
    reserveArea(reserved, room, cols, rows, reserveRadius);
  }

  const theme = mapDef?.theme ?? 'ruins';
  const defaultTerrainByTheme = {
    ruins: ['mud', 'ash'],
    wastes: ['ash', 'cracked_ice', 'mud'],
    archive: ['shallow_water', 'cracked_ice'],
    cathedral: ['brambles', 'mud', 'ash'],
    abyss: ['ash', 'brambles', 'shallow_water'],
  };
  const requested = mapDef?.terrainProfile && mapDef.terrainProfile !== 'auto'
    ? String(mapDef.terrainProfile).split('+').map((v) => v.trim()).filter(Boolean)
    : (defaultTerrainByTheme[theme] ?? ['mud', 'ash']);
  const activeTerrainIds = requested.filter((id, idx, arr) => TERRAIN_BY_ID[id] && arr.indexOf(id) === idx).slice(0, 3);
  if (activeTerrainIds.length === 0) {
    activeTerrainIds.push('mud');
  }

  const weightedTerrainIds = [];
  const bias = terrainOptions?.terrainBiasById ?? {};
  for (const id of activeTerrainIds) {
    const mult = Math.max(1, Number(bias[id] ?? 1));
    for (let i = 0; i < mult; i++) weightedTerrainIds.push(id);
  }

  const terrainPalette = Object.fromEntries(activeTerrainIds.map((id) => [id, TERRAIN_BY_ID[id].code]));

  for (const room of typedRooms) {
    if (room.type === 'start' || room.type === 'boss') continue;
    if (room.w * room.h < 36) continue;
    if (rng() < 0.2) continue;

    const terrainId = pick(rng, weightedTerrainIds.length ? weightedTerrainIds : activeTerrainIds);
    const terrainCode = TERRAIN_BY_ID[terrainId].code;
    const extraPockets = Math.max(0, Math.round(terrainOptions?.terrainExtraPockets ?? 0));
    const pockets = (room.type === 'elite' ? randInt(rng, 2, 3) : randInt(rng, 1, 2)) + extraPockets;

    for (let p = 0; p < pockets; p++) {
      const cx = randInt(rng, room.x + 2, room.x + room.w - 3);
      const cy = randInt(rng, room.y + 2, room.y + room.h - 3);
      const radius = randInt(rng, 2, Math.max(3, Math.min(5, Math.floor(Math.min(room.w, room.h) * 0.26))));
      paintTerrainBlob(terrainMask, terrainCode, cx, cy, radius, cols, rows, tiles, obstacleOccupancyMask, reserved);
    }
  }

  return {
    terrainMask,
    terrainPalette,
  };
}

function carveDisk(tiles, rows, cols, cx, cy, radius, value = 0) {
  const r = Math.max(1, radius);
  const rSq = r * r;
  const minX = Math.floor(cx - r);
  const maxX = Math.ceil(cx + r);
  const minY = Math.floor(cy - r);
  const maxY = Math.ceil(cy + r);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) continue;
      const dx = tx - cx;
      const dy = ty - cy;
      if (dx * dx + dy * dy <= rSq) {
        tiles[ty][tx] = value;
      }
    }
  }
}

function carveWormTunnel(tiles, rows, cols, from, to, rng, radiusMin = 1.35, radiusMax = 2.25) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const steps = Math.max(8, Math.ceil(dist * 1.25));
  let cx = from.x;
  let cy = from.y;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const tx = from.x + dx * t;
    const ty = from.y + dy * t;
    const sway = Math.sin(t * Math.PI * 2 + rng() * Math.PI) * 0.85;
    cx += (tx - cx) * 0.45 + sway * 0.04;
    cy += (ty - cy) * 0.45 + sway * 0.04;
    const radius = radiusMin + (radiusMax - radiusMin) * rng();
    carveDisk(tiles, rows, cols, cx, cy, radius, 0);
  }
}

function smoothCavernTiles(tiles, rows, cols, passes = 1) {
  for (let p = 0; p < passes; p++) {
    const next = tiles.map((row) => [...row]);
    for (let ty = 1; ty < rows - 1; ty++) {
      for (let tx = 1; tx < cols - 1; tx++) {
        let floorCount = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (tiles[ty + oy][tx + ox] === 0) floorCount++;
          }
        }
        if (tiles[ty][tx] === 1 && floorCount >= 6) next[ty][tx] = 0;
        if (tiles[ty][tx] === 0 && floorCount <= 2) next[ty][tx] = 1;
      }
    }
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        tiles[ty][tx] = next[ty][tx];
      }
    }
  }
}

function buildRoomBoundsFromTiles(id, type, shape, tiles) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const tile of tiles) {
    if (tile.tx < minX) minX = tile.tx;
    if (tile.ty < minY) minY = tile.ty;
    if (tile.tx > maxX) maxX = tile.tx;
    if (tile.ty > maxY) maxY = tile.ty;
  }
  return {
    id,
    type,
    roomShape: shape,
    bossArenaStyle: null,
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    centerX: Math.round((minX + maxX) / 2),
    centerY: Math.round((minY + maxY) / 2),
  };
}

function placeRoomAnchorDecor(room, tiles, cols, rows, rng, obstacleMask, obstacleOccupancyMask, obstacles, reserved) {
  const anchors = [
    [room.x + 1, room.y + 1],
    [room.x + room.w - 2, room.y + 1],
    [room.x + 1, room.y + room.h - 2],
    [room.x + room.w - 2, room.y + room.h - 2],
  ];
  for (const [tx, ty] of anchors) {
    if (rng() < 0.35) {
      const decoType = rng() < 0.6 ? 'torch' : 'banner';
      placeObstacle(obstacles, obstacleMask, obstacleOccupancyMask, tiles, cols, rows, room, decoType, [{ tx, ty }], {
        reserved,
      });
    }
  }
}

function placeEliteCluster(room, tiles, cols, rows, rng, obstacleMask, obstacleOccupancyMask, obstacles, reserved) {
  const centerX = room.centerX + randInt(rng, -1, 1);
  const centerY = room.centerY + randInt(rng, -1, 1);
  const clusterPattern = [[0, 0], [1, 0], [-1, 0], [0, 1]];
  for (const [ox, oy] of clusterPattern) {
    if (rng() < 0.85) {
      const tx = centerX + ox;
      const ty = centerY + oy;
      const type = rng() < 0.55 ? 'rubble' : 'pillar';
      const footprint = type === 'rubble' ? makeFootprint(tx, ty, [[0, 0], [1, 0]]) : [{ tx, ty }];
      placeObstacle(obstacles, obstacleMask, obstacleOccupancyMask, tiles, cols, rows, room, type, footprint, {
        reserved,
      });
    }
  }
}

function seedCombatObstacles(typedRooms, tiles, cols, rows, rng, obstacleMask, obstacleOccupancyMask, obstacles) {
  const reserved = new Set();
  for (const room of typedRooms) reserveArea(reserved, room, cols, rows, room.type === 'boss' ? 2 : 1);

  for (const room of typedRooms) {
    if (room.type !== 'combat' && room.type !== 'elite') continue;
    const area = room.w * room.h;
    if (area < 48) continue;

    const attempts = room.type === 'elite' ? 8 : 5;
    const target = room.type === 'elite' ? randInt(rng, 2, 4) : randInt(rng, 1, 3);
    let placedCount = 0;

    for (let i = 0; i < attempts && placedCount < target; i++) {
      const tx = randInt(rng, room.x + 2, room.x + room.w - 3);
      const ty = randInt(rng, room.y + 2, room.y + room.h - 3);
      const obstacleType = rng() < 0.6 ? 'pillar' : 'rubble';
      const footprint = obstacleType === 'pillar'
        ? [{ tx, ty }]
        : makeFootprint(tx, ty, [[0, 0], [1, 0]]);

      const ok = placeObstacle(obstacles, obstacleMask, obstacleOccupancyMask, tiles, cols, rows, room, obstacleType, footprint, {
        reserved,
      });
      if (ok) placedCount++;
    }

    placeRoomAnchorDecor(room, tiles, cols, rows, rng, obstacleMask, obstacleOccupancyMask, obstacles, reserved);
    if (room.type === 'elite') {
      placeEliteCluster(room, tiles, cols, rows, rng, obstacleMask, obstacleOccupancyMask, obstacles, reserved);
    }
  }
}

function placeBossSymmetryPair(bossRoom, tiles, cols, rows, obstacleMask, obstacleOccupancyMask, obstacles, type, offsetX, offsetY, reserved) {
  placeObstacle(obstacles, obstacleMask, obstacleOccupancyMask, tiles, cols, rows, bossRoom, type, [{ tx: bossRoom.centerX - offsetX, ty: bossRoom.centerY + offsetY }], {
    reserved,
    category: OBSTACLE_CATEGORY.BOSS_PROP,
  });
  placeObstacle(obstacles, obstacleMask, obstacleOccupancyMask, tiles, cols, rows, bossRoom, type, [{ tx: bossRoom.centerX + offsetX, ty: bossRoom.centerY + offsetY }], {
    reserved,
    category: OBSTACLE_CATEGORY.BOSS_PROP,
  });
}

function applyBossArenaTemplate(bossRoom, tiles, cols, rows, rng, obstacleMask, obstacleOccupancyMask, obstacles) {
  if (!bossRoom) return;
  const reserved = new Set();
  reserveArea(reserved, bossRoom, cols, rows, 2);

  const style = pick(rng, ['duel_circle', 'pillar_hall', 'throne_dais', 'broken_arena', 'chapel_cross']);
  bossRoom.bossArenaStyle = style;

  if (style === 'duel_circle') {
    const corners = [
      [bossRoom.x + 1, bossRoom.y + 1],
      [bossRoom.x + bossRoom.w - 2, bossRoom.y + 1],
      [bossRoom.x + 1, bossRoom.y + bossRoom.h - 2],
      [bossRoom.x + bossRoom.w - 2, bossRoom.y + bossRoom.h - 2],
    ];
    for (const [tx, ty] of corners) {
      tiles[ty][tx] = 1;
    }
    return;
  }

  if (style === 'pillar_hall') {
    const pillarOffsets = [
      [-2, -2], [2, -2], [-2, 2], [2, 2],
    ];
    for (const [ox, oy] of pillarOffsets) {
      placeObstacle(obstacles, obstacleMask, obstacleOccupancyMask, tiles, cols, rows, bossRoom, 'pillar', [{ tx: bossRoom.centerX + ox, ty: bossRoom.centerY + oy }], {
        reserved,
        category: OBSTACLE_CATEGORY.BOSS_PROP,
      });
    }
    placeBossSymmetryPair(bossRoom, tiles, cols, rows, obstacleMask, obstacleOccupancyMask, obstacles, 'torch', 4, -2, reserved);
    return;
  }

  if (style === 'throne_dais') {
    const daisY = bossRoom.y + 1;
    for (let tx = bossRoom.centerX - 1; tx <= bossRoom.centerX + 1; tx++) {
      placeObstacle(obstacles, obstacleMask, obstacleOccupancyMask, tiles, cols, rows, bossRoom, 'altar', [{ tx, ty: daisY }], {
        reserved,
      });
    }
    placeBossSymmetryPair(bossRoom, tiles, cols, rows, obstacleMask, obstacleOccupancyMask, obstacles, 'banner', 3, -2, reserved);
    return;
  }

  if (style === 'broken_arena') {
    const rubbleSpots = [
      [bossRoom.x + 2, bossRoom.y + 2],
      [bossRoom.x + bossRoom.w - 4, bossRoom.y + 2],
      [bossRoom.x + 2, bossRoom.y + bossRoom.h - 3],
      [bossRoom.x + bossRoom.w - 4, bossRoom.y + bossRoom.h - 3],
    ];
    for (const [tx, ty] of rubbleSpots) {
      placeObstacle(obstacles, obstacleMask, obstacleOccupancyMask, tiles, cols, rows, bossRoom, 'rubble', makeFootprint(tx, ty, [[0, 0], [1, 0]]), {
        reserved,
        category: OBSTACLE_CATEGORY.BOSS_PROP,
      });
    }
    return;
  }

  if (style === 'chapel_cross') {
    const northY = bossRoom.y + 1;
    placeObstacle(obstacles, obstacleMask, obstacleOccupancyMask, tiles, cols, rows, bossRoom, 'altar', [{ tx: bossRoom.centerX, ty: northY }], {
      reserved,
    });
    placeObstacle(obstacles, obstacleMask, obstacleOccupancyMask, tiles, cols, rows, bossRoom, 'pillar', [{ tx: bossRoom.centerX - 2, ty: bossRoom.centerY }], {
      reserved,
      category: OBSTACLE_CATEGORY.BOSS_PROP,
    });
    placeObstacle(obstacles, obstacleMask, obstacleOccupancyMask, tiles, cols, rows, bossRoom, 'pillar', [{ tx: bossRoom.centerX + 2, ty: bossRoom.centerY }], {
      reserved,
      category: OBSTACLE_CATEGORY.BOSS_PROP,
    });
    placeBossSymmetryPair(bossRoom, tiles, cols, rows, obstacleMask, obstacleOccupancyMask, obstacles, 'torch', 3, 2, reserved);
  }
}

function buildFloorTileLists(typedRooms, map, obstacleMask, obstacleOccupancyMask = obstacleMask, terrainMask = null) {
  const floorTiles = [];

  for (let ty = 1; ty < map.rows - 1; ty++) {
    for (let tx = 1; tx < map.cols - 1; tx++) {
      const terrainCode = terrainMask ? terrainMask[keyOf(tx, ty, map.cols)] : TERRAIN_CODE.NONE;
      const terrainDef = TERRAIN_DEFS[terrainCode];
      const isSpawnRestricted = !!terrainDef?.spawnRestricted;
      if (map.tiles[ty][tx] === 0 && !obstacleOccupancyMask[keyOf(tx, ty, map.cols)] && !isSpawnRestricted) {
        floorTiles.push({ tx, ty });
      }
    }
  }

  for (const room of typedRooms) {
    room.floorTiles = [];
    for (let ty = room.y + 1; ty < room.y + room.h - 1; ty++) {
      for (let tx = room.x + 1; tx < room.x + room.w - 1; tx++) {
        const terrainCode = terrainMask ? terrainMask[keyOf(tx, ty, map.cols)] : TERRAIN_CODE.NONE;
        const terrainDef = TERRAIN_DEFS[terrainCode];
        const isSpawnRestricted = !!terrainDef?.spawnRestricted;
        if (map.tiles[ty]?.[tx] === 0 && !obstacleOccupancyMask[keyOf(tx, ty, map.cols)] && !isSpawnRestricted) {
          room.floorTiles.push({ tx, ty });
        }
      }
    }
    if (room.floorTiles.length === 0) {
      room.floorTiles.push({ tx: room.centerX, ty: room.centerY });
    }
  }

  return floorTiles;
}

const DEFAULT_LAYOUT_FAMILY = 'bsp_fortress';
const DEFAULT_PATH_STYLE = 'branching';

function resolvePhase9MapModEffects(mapDef = {}, layoutFamily = DEFAULT_LAYOUT_FAMILY) {
  const mods = Array.isArray(mapDef?.mods) ? mapDef.mods : [];
  const activeModIds = mods.map((mod) => String(mod?.id ?? '')).filter(Boolean);
  const has = (id) => activeModIds.includes(id);

  const pre = {
    bspMaxDepthDelta: 0,
    bspMinLeafDelta: 0,
    corridorWidthMin: 1,
    corridorWidthMax: 3,
    forceRoomShapePool: null,
    cavernExtraLoopsMult: 1,
    cavernRadiusMult: 1,
    laneCountDelta: 0,
    laneDriftBoost: 0,
    chokepointTightness: 1,
  };

  const post = {
    obstacleDensityMult: 1,
    addFenceBias: 0,
    terrainBiasById: {},
    terrainExtraPockets: 0,
    floodBandPasses: 0,
    overgrowthPasses: 0,
    corruptionPasses: 0,
    volatileHazardPressure: 0,
    visualOverlays: [],
  };

  const notes = [];

  if (has('twisting')) {
    pre.bspMaxDepthDelta += 1;
    pre.bspMinLeafDelta -= 1;
    pre.corridorWidthMin = 1;
    pre.corridorWidthMax = 2;
    pre.forceRoomShapePool = ['offset', 'clipped', 'hall', 'pill'];
    pre.cavernExtraLoopsMult *= 1.45;
    pre.cavernRadiusMult *= 0.95;
    pre.laneCountDelta += 1;
    pre.laneDriftBoost += 2;
    pre.chokepointTightness *= 1.12;
    notes.push('Twisting remaps pre-generation corridor and lane flow.');
  }

  if (has('fortified')) {
    pre.corridorWidthMin = Math.max(1, pre.corridorWidthMin);
    pre.corridorWidthMax = Math.min(pre.corridorWidthMax, 2);
    post.obstacleDensityMult *= 1.42;
    post.addFenceBias += 0.35;
    post.visualOverlays.push('fortified_lines');
    notes.push('Fortified increases post-generation chokepoint obstacles.');
  }

  if (has('flooded')) {
    post.terrainBiasById.shallow_water = (post.terrainBiasById.shallow_water ?? 0) + 3;
    post.terrainBiasById.cracked_ice = (post.terrainBiasById.cracked_ice ?? 0) + 1;
    post.terrainExtraPockets += 1;
    post.floodBandPasses += 1;
    post.visualOverlays.push('flooded_tint');
    notes.push('Flooded increases shallow-water coverage and flood bands.');
  }

  if (has('overgrown')) {
    post.terrainBiasById.brambles = (post.terrainBiasById.brambles ?? 0) + 3;
    post.terrainBiasById.mud = (post.terrainBiasById.mud ?? 0) + 1;
    post.overgrowthPasses += 1;
    post.addFenceBias += 0.2;
    post.visualOverlays.push('overgrown_tint');
    notes.push('Overgrown adds bramble-focused terrain and decorative blockers.');
  }

  if (has('volatile')) {
    post.volatileHazardPressure += 1;
    post.visualOverlays.push('volatile_glyphs');
    notes.push('Volatile raises hazard pressure around setpieces and boss approach.');
  }

  if (has('corrupted')) {
    post.corruptionPasses += 1;
    post.visualOverlays.push('corrupted_veil');
    notes.push('Corrupted adds arena corruption variants and late-traversal pressure.');
  }

  let hybridRemix = null;
  if (has('twisting') && (has('flooded') || has('overgrown'))) {
    const hintFamily = layoutFamily === 'bsp_fortress'
      ? 'meandering_cavern'
      : layoutFamily === 'meandering_cavern'
        ? 'gauntlet_lane'
        : 'bsp_fortress';
    hybridRemix = {
      enabled: true,
      hintFamily,
      reason: has('flooded') ? 'twisting+flooded' : 'twisting+overgrown',
    };
    if (hintFamily === 'meandering_cavern') {
      pre.cavernExtraLoopsMult *= 1.15;
      pre.laneDriftBoost += 1;
    } else if (hintFamily === 'gauntlet_lane') {
      pre.laneCountDelta += 1;
      pre.chokepointTightness *= 1.08;
    } else {
      pre.bspMaxDepthDelta += 1;
      pre.forceRoomShapePool = ['hall', 'offset', 'clipped'];
    }
    notes.push(`Hybrid remix hint applied via existing family semantics: ${hintFamily}.`);
  }

  return {
    activeModIds,
    pre,
    post,
    hybridRemix,
    notes,
  };
}

function applyPhase9PostGenerationDecor({
  typedRooms,
  tiles,
  cols,
  rows,
  rng,
  obstacleMask,
  obstacleOccupancyMask,
  obstacles,
  terrainMask,
  encounterMetadata,
  modEffects,
}) {
  if (!modEffects?.activeModIds?.length) return [];

  const notes = [];
  const reserved = new Set();
  for (const room of typedRooms) {
    if (room.type === 'start' || room.type === 'boss') reserveArea(reserved, room, cols, rows, 2);
  }

  const applyExtraObstaclePass = modEffects.post.obstacleDensityMult > 1.01;
  if (applyExtraObstaclePass) {
    for (const room of typedRooms) {
      if (room.type !== 'combat' && room.type !== 'elite') continue;
      const attempts = Math.max(1, Math.round((roomArea(room) / 42) * (modEffects.post.obstacleDensityMult - 1)));
      for (let i = 0; i < attempts; i++) {
        const tx = randInt(rng, room.x + 1, room.x + room.w - 2);
        const ty = randInt(rng, room.y + 1, room.y + room.h - 2);
        const wantFence = rng() < modEffects.post.addFenceBias;
        const type = wantFence ? 'fence' : (rng() < 0.6 ? 'rubble' : 'pillar');
        const footprint = type === 'rubble' ? makeFootprint(tx, ty, [[0, 0], [1, 0]]) : [{ tx, ty }];
        placeObstacle(obstacles, obstacleMask, obstacleOccupancyMask, tiles, cols, rows, room, type, footprint, { reserved });
      }
    }
    notes.push('Fortified post-pass injected additional blocking props.');
  }

  if ((modEffects.post.floodBandPasses ?? 0) > 0) {
    const waterCode = TERRAIN_BY_ID.shallow_water?.code ?? TERRAIN_CODE.SHALLOW_WATER;
    const passes = Math.max(1, modEffects.post.floodBandPasses);
    for (let pass = 0; pass < passes; pass++) {
      const y = randInt(rng, 4, rows - 5);
      for (let tx = 4; tx < cols - 4; tx += randInt(rng, 2, 4)) {
        const radius = randInt(rng, 1, 2);
        paintTerrainBlob(terrainMask, waterCode, tx, y + randInt(rng, -1, 1), radius, cols, rows, tiles, obstacleOccupancyMask, reserved);
      }
    }
    notes.push('Flooded post-pass painted shallow-water bands.');
  }

  if ((modEffects.post.overgrowthPasses ?? 0) > 0) {
    const brambleCode = TERRAIN_BY_ID.brambles?.code ?? TERRAIN_CODE.BRAMBLES;
    const mudCode = TERRAIN_BY_ID.mud?.code ?? TERRAIN_CODE.MUD;
    for (const room of typedRooms) {
      if (room.type === 'start' || room.type === 'boss') continue;
      if (rng() < 0.35) continue;
      const cx = randInt(rng, room.x + 1, room.x + room.w - 2);
      const cy = randInt(rng, room.y + 1, room.y + room.h - 2);
      paintTerrainBlob(terrainMask, brambleCode, cx, cy, randInt(rng, 2, 4), cols, rows, tiles, obstacleOccupancyMask, reserved);
      paintTerrainBlob(terrainMask, mudCode, cx + randInt(rng, -2, 2), cy + randInt(rng, -2, 2), randInt(rng, 1, 3), cols, rows, tiles, obstacleOccupancyMask, reserved);
    }
    notes.push('Overgrown post-pass painted bramble/mud growth pockets.');
  }

  if ((modEffects.post.corruptionPasses ?? 0) > 0 && encounterMetadata) {
    const ashCode = TERRAIN_BY_ID.ash?.code ?? TERRAIN_CODE.ASH;
    const brambleCode = TERRAIN_BY_ID.brambles?.code ?? TERRAIN_CODE.BRAMBLES;
    const finalThirdRoomIds = encounterMetadata?.bossApproach?.finalThirdRoomIds ?? [];
    for (const roomId of finalThirdRoomIds) {
      const room = typedRooms.find((r) => r.id === roomId);
      if (!room) continue;
      for (let pass = 0; pass < modEffects.post.corruptionPasses; pass++) {
        paintTerrainBlob(
          terrainMask,
          ashCode,
          room.centerX + randInt(rng, -2, 2),
          room.centerY + randInt(rng, -2, 2),
          randInt(rng, 2, 4),
          cols,
          rows,
          tiles,
          obstacleOccupancyMask,
          reserved,
        );
        paintTerrainBlob(
          terrainMask,
          brambleCode,
          room.centerX + randInt(rng, -2, 2),
          room.centerY + randInt(rng, -2, 2),
          randInt(rng, 1, 3),
          cols,
          rows,
          tiles,
          obstacleOccupancyMask,
          reserved,
        );
      }
      pushUniqueTag(encounterMetadata.roomTagsById, room.id, 'corrupted_zone');
      pushUniqueTag(encounterMetadata.roomTagsById, room.id, 'late_corruption');
      room.encounterTags = [...new Set([...(room.encounterTags ?? []), 'corrupted_zone'])];
    }

    for (const node of encounterMetadata.setpieceNodes ?? []) {
      if (node.type === SETPIECE_TYPE.TRAP_ANTECHAMBER || node.type === SETPIECE_TYPE.BOSS_PRELUDE_HALL) {
        node.tags = Array.isArray(node.tags)
          ? [...new Set([...node.tags, 'corrupted', 'corrupted_approach'])]
          : ['corrupted', 'corrupted_approach'];
      }
    }

    if (encounterMetadata.hazardProfile !== 'volatile') {
      encounterMetadata.hazardProfile = 'corrupted';
    }
    notes.push('Corrupted post-pass marked late traversal corruption pressure.');
  }

  if ((modEffects.post.volatileHazardPressure ?? 0) > 0 && encounterMetadata) {
    encounterMetadata.hazardProfile = 'volatile';
    for (const node of encounterMetadata.setpieceNodes ?? []) {
      if (node.type === SETPIECE_TYPE.TRAP_ANTECHAMBER || node.type === SETPIECE_TYPE.BOSS_PRELUDE_HALL) {
        node.tags = Array.isArray(node.tags) ? [...new Set([...node.tags, 'volatile', 'periodic_hazard'])] : ['volatile', 'periodic_hazard'];
      }
    }
    for (const roomId of encounterMetadata?.bossApproach?.finalThirdRoomIds ?? []) {
      const room = typedRooms.find((r) => r.id === roomId);
      if (!room) continue;
      room.encounterTags = [...new Set([...(room.encounterTags ?? []), 'volatile_zone'])];
    }
    notes.push('Volatile post-pass marked final-third hazard pressure tags.');
  }

  return notes;
}

function applyPhase9CorruptionVariant({ bossRoom, typedRooms, encounterMetadata, modEffects, rng }) {
  if (!modEffects?.activeModIds?.includes('corrupted') || !bossRoom) return null;

  const variants = ['void_fracture', 'blood_ritual', 'blight_spiral'];
  const variant = variants[randInt(rng, 0, variants.length - 1)];
  bossRoom.corruptionVariant = variant;

  if (encounterMetadata) {
    pushUniqueTag(encounterMetadata.roomTagsById, bossRoom.id, 'boss_arena_corrupted');
    pushUniqueTag(encounterMetadata.roomTagsById, bossRoom.id, `boss_corruption_${variant}`);

    for (const node of encounterMetadata.setpieceNodes ?? []) {
      if (node.type === SETPIECE_TYPE.BOSS_PRELUDE_HALL || node.type === SETPIECE_TYPE.TRAP_ANTECHAMBER) {
        node.tags = Array.isArray(node.tags)
          ? [...new Set([...node.tags, 'corrupted'])]
          : ['corrupted'];
      }
    }
  }

  for (const room of typedRooms ?? []) {
    if (room.id !== bossRoom.id) continue;
    room.encounterTags = [...new Set([...(room.encounterTags ?? []), 'boss_arena_corrupted'])];
  }

  return variant;
}

const SETPIECE_TYPE = {
  SHRINE_ROOM: 'shrine_room',
  ELITE_AMBUSH_ROOM: 'elite_ambush_room',
  CURSED_CHEST_POCKET: 'cursed_chest_pocket',
  TRAP_ANTECHAMBER: 'trap_antechamber',
  VAULT_SIDE_ROOM: 'vault_side_room',
  BOSS_PRELUDE_HALL: 'boss_prelude_hall',
};

function distanceSqBetweenRooms(a, b) {
  const dx = (a?.centerX ?? 0) - (b?.centerX ?? 0);
  const dy = (a?.centerY ?? 0) - (b?.centerY ?? 0);
  return dx * dx + dy * dy;
}

function roomArea(room) {
  return Math.max(1, (room?.w ?? 1) * (room?.h ?? 1));
}

function pickRoomByPriority(candidates, fallback, usedIds) {
  for (const room of candidates) {
    if (!room || usedIds.has(room.id)) continue;
    usedIds.add(room.id);
    return room;
  }
  if (fallback && !usedIds.has(fallback.id)) {
    usedIds.add(fallback.id);
    return fallback;
  }
  return fallback ?? null;
}

function makeSetpieceNode(type, room, index, tags = [], stage = 'mid') {
  return {
    id: `setpiece_${index}_${type}`,
    type,
    roomId: room.id,
    roomType: room.type,
    stage,
    centerTile: { tx: room.centerX, ty: room.centerY },
    bounds: {
      x: room.x,
      y: room.y,
      w: room.w,
      h: room.h,
    },
    tags,
  };
}

function pushUniqueTag(roomTagsById, roomId, tag) {
  if (!roomId || !tag) return;
  if (!Array.isArray(roomTagsById[roomId])) roomTagsById[roomId] = [];
  if (!roomTagsById[roomId].includes(tag)) roomTagsById[roomId].push(tag);
}

function progressionStageForRoom(room, startRoom, bossRoom) {
  const startToBoss = Math.max(1, distanceSqBetweenRooms(startRoom, bossRoom));
  const roomToBoss = distanceSqBetweenRooms(room, bossRoom);
  const progressToBoss = Math.max(0, Math.min(1, 1 - (roomToBoss / startToBoss)));
  if (progressToBoss >= 0.67) return 'late';
  if (progressToBoss >= 0.34) return 'mid';
  return 'early';
}

function buildEncounterMetadata(typedRooms, startRoom, bossRoom, mapDef) {
  const clusterRooms = typedRooms.filter((room) => room.type !== 'start' && room.type !== 'boss');
  const withBossDist = clusterRooms.map((room) => ({
    room,
    distToBossSq: distanceSqBetweenRooms(room, bossRoom),
    distFromStartSq: distanceSqBetweenRooms(room, startRoom),
    area: roomArea(room),
  }));

  withBossDist.sort((a, b) => a.distToBossSq - b.distToBossSq);
  const finalThirdCount = Math.max(1, Math.ceil(withBossDist.length / 3));
  const finalThird = withBossDist.slice(0, finalThirdCount).map((entry) => entry.room);
  const earlyThird = withBossDist.slice(-finalThirdCount).map((entry) => entry.room);
  const midRooms = withBossDist
    .slice(finalThirdCount, Math.max(finalThirdCount, withBossDist.length - finalThirdCount))
    .map((entry) => entry.room);

  const used = new Set();
  const preludeCandidates = [...finalThird]
    .sort((a, b) => roomArea(b) - roomArea(a));
  const preludeRoom = pickRoomByPriority(preludeCandidates, finalThird[0] ?? clusterRooms[0] ?? bossRoom, used);

  const shrineCandidates = [...earlyThird]
    .sort((a, b) => roomArea(b) - roomArea(a));
  const shrineRoom = pickRoomByPriority(shrineCandidates, clusterRooms[0] ?? preludeRoom, used);

  const eliteAmbushCandidates = [...midRooms, ...clusterRooms]
    .filter((room) => room.type === 'elite' || room.type === 'combat')
    .sort((a, b) => (b.type === 'elite') - (a.type === 'elite'));
  const eliteAmbushRoom = pickRoomByPriority(eliteAmbushCandidates, clusterRooms[1] ?? preludeRoom, used);

  const cursedChestCandidates = [...clusterRooms]
    .filter((room) => room.type === 'treasure' || room.type === 'combat')
    .sort((a, b) => roomArea(a) - roomArea(b));
  const cursedChestRoom = pickRoomByPriority(cursedChestCandidates, clusterRooms[2] ?? preludeRoom, used);

  const trapAnteCandidates = [...finalThird]
    .filter((room) => room.id !== preludeRoom?.id)
    .sort((a, b) => roomArea(a) - roomArea(b));
  const trapAnteRoom = pickRoomByPriority(trapAnteCandidates, finalThird[1] ?? preludeRoom, used);

  const vaultCandidates = [...midRooms, ...earlyThird]
    .filter((room) => room.type !== 'elite')
    .sort((a, b) => roomArea(a) - roomArea(b));
  const vaultRoom = pickRoomByPriority(vaultCandidates, clusterRooms[3] ?? cursedChestRoom ?? preludeRoom, used);

  const setpieceNodes = [];
  let idx = 0;
  if (shrineRoom) {
    setpieceNodes.push(makeSetpieceNode(SETPIECE_TYPE.SHRINE_ROOM, shrineRoom, idx++, ['shrine', 'support'], 'early'));
  }
  if (eliteAmbushRoom) {
    setpieceNodes.push(makeSetpieceNode(SETPIECE_TYPE.ELITE_AMBUSH_ROOM, eliteAmbushRoom, idx++, ['elite', 'ambush'], 'mid'));
  }
  if (cursedChestRoom) {
    setpieceNodes.push(makeSetpieceNode(SETPIECE_TYPE.CURSED_CHEST_POCKET, cursedChestRoom, idx++, ['treasure', 'risk'], 'mid'));
  }
  if (trapAnteRoom) {
    setpieceNodes.push(makeSetpieceNode(SETPIECE_TYPE.TRAP_ANTECHAMBER, trapAnteRoom, idx++, ['hazard', 'chokepoint'], 'late'));
  }
  if (vaultRoom) {
    setpieceNodes.push(makeSetpieceNode(SETPIECE_TYPE.VAULT_SIDE_ROOM, vaultRoom, idx++, ['reward', 'optional'], 'mid'));
  }
  if (preludeRoom) {
    setpieceNodes.push(makeSetpieceNode(SETPIECE_TYPE.BOSS_PRELUDE_HALL, preludeRoom, idx++, ['boss_approach', 'staging'], 'late'));
  }

  const roomTagsById = {};
  for (const room of typedRooms) roomTagsById[room.id] = [];
  for (const node of setpieceNodes) {
    pushUniqueTag(roomTagsById, node.roomId, node.type);
    pushUniqueTag(roomTagsById, node.roomId, `setpiece_stage_${node.stage}`);
  }

  const finalThirdRoomIds = finalThird.map((room) => room.id);
  const finalThirdRoomIdSet = new Set(finalThirdRoomIds);
  for (const room of typedRooms) {
    const stage = progressionStageForRoom(room, startRoom, bossRoom);
    pushUniqueTag(roomTagsById, room.id, `progress_stage_${stage}`);
    if (finalThirdRoomIdSet.has(room.id)) {
      pushUniqueTag(roomTagsById, room.id, 'boss_approach_final_third');
      pushUniqueTag(roomTagsById, room.id, 'boss_approach_staging');
    }
  }

  for (const room of typedRooms) {
    room.encounterTags = roomTagsById[room.id] ?? [];
    room.progressToBoss = Math.max(0, Math.min(1, 1 - (distanceSqBetweenRooms(room, bossRoom) / Math.max(1, distanceSqBetweenRooms(startRoom, bossRoom)))));
  }

  const bossApproach = {
    preludeRoomId: preludeRoom?.id ?? null,
    finalThirdRoomIds,
    stageSequence: [
      SETPIECE_TYPE.SHRINE_ROOM,
      SETPIECE_TYPE.ELITE_AMBUSH_ROOM,
      SETPIECE_TYPE.TRAP_ANTECHAMBER,
      SETPIECE_TYPE.BOSS_PRELUDE_HALL,
    ],
    style: mapDef?.pathStyle ?? DEFAULT_PATH_STYLE,
  };

  return {
    version: 2,
    setpieceNodes,
    roomTagsById,
    bossApproach,
  };
}

/**
 * MapGenerator (Phase 2 orchestrator)
 *
 * Normalized map layout contract returned by `generate`:
 * - `layoutApiVersion: number`
 * - `layoutFamily: string`
 * - `pathStyle: string`
 * - `generatorId: string`
 * - `regions: Array<{ id, type, x, y, w, h, centerX, centerY }>` (alias of rooms)
 * - `rooms`, `clusterRooms`, `startRoom`, `bossRoom`
 * - `tiles`, `floorTiles`, `obstacles`, `obstacleMask`
 * - `worldLeft`, `worldTop`, `cols`, `rows`, `tileSize`, `seed`, `mapId`, `tier`
 * - helper funcs: `isWall`, `isWalkableTile`, `worldToTile`, `tileToWorld`, `isWalkableWorld`, `findSpawnPointNear`
 *
 * Phase 2 keeps a single family implementation (`bsp_fortress`) and introduces
 * a family dispatch/orchestration layer for future families.
 */
export class MapGenerator {
  static generate(mapDef, seed = (Math.random() * 0xffffffff) >>> 0) {
    const resolvedMapDef = this._resolveMapLayoutConfig(mapDef);
    const generator = this._pickGeneratorForFamily(resolvedMapDef.layoutFamily);
    const map = generator.call(this, resolvedMapDef, seed);
    return this._normalizeGeneratedLayout(map, resolvedMapDef);
  }

  static _resolveMapLayoutConfig(mapDef) {
    return {
      ...(mapDef ?? {}),
      layoutFamily: mapDef?.layoutFamily ?? DEFAULT_LAYOUT_FAMILY,
      pathStyle: mapDef?.pathStyle ?? DEFAULT_PATH_STYLE,
    };
  }

  static _pickGeneratorForFamily(layoutFamily) {
    const handlers = {
      bsp_fortress: this._generateBspFortressLayout,
      meandering_cavern: this._generateMeanderingCavernLayout,
      gauntlet_lane: this._generateGauntletLaneLayout,
      open_fields: this._generateOpenFieldsLayout,
    };
    return handlers[layoutFamily] ?? this._generateBspFortressLayout;
  }

  static _normalizeGeneratedLayout(map, resolvedMapDef) {
    const layoutFamily = resolvedMapDef.layoutFamily ?? DEFAULT_LAYOUT_FAMILY;
    const pathStyle = resolvedMapDef.pathStyle ?? DEFAULT_PATH_STYLE;
    const regions = Array.isArray(map.rooms) ? map.rooms.map((room) => ({
      id: room.id,
      type: room.type,
      x: room.x,
      y: room.y,
      w: room.w,
      h: room.h,
      centerX: room.centerX,
      centerY: room.centerY,
      roomShape: room.roomShape,
      bossArenaStyle: room.bossArenaStyle,
      corruptionVariant: room.corruptionVariant ?? null,
      encounterTags: room.encounterTags ?? [],
    })) : [];
    const obstacles = Array.isArray(map.obstacles)
      ? map.obstacles.map((obstacle) => {
        const spec = resolveObstacleSpec(obstacle.type, obstacle);
        return {
          ...obstacle,
          category: obstacle.category ?? spec.category,
          collision: obstacle.collision ?? spec.collision,
          blocksLineOfSight: obstacle.blocksLineOfSight ?? spec.blocksLineOfSight,
          radiusTiles: obstacle.radiusTiles ?? spec.radiusTiles,
          footprint: obstacle.footprint ?? obstacle.tiles ?? [],
          tiles: obstacle.tiles ?? obstacle.footprint ?? [],
          footprintType: obstacle.footprintType ?? ((obstacle.tiles?.length ?? 0) > 1 ? 'multi_tile' : 'single_tile'),
          renderHint: obstacle.renderHint ?? {},
        };
      })
      : [];

    return {
      ...map,
      layoutApiVersion: 1,
      layoutFamily,
      pathStyle,
      generatorId: `${layoutFamily}@v1`,
      regions,
      obstacles,
      encounterMetadata: map.encounterMetadata ?? null,
      mapModMetadata: map.mapModMetadata ?? null,
    };
  }

  static _generateBspFortressLayout(mapDef, seed) {
    const rng = mulberry32(seed >>> 0);
    const areaLevel = Math.max(1, mapDef?.areaLevel ?? mapDef?.sourceMapItemLevel ?? 1);
    const progression = Math.max(1, Math.floor((areaLevel + 1) / 12));
    const mapModEffects = resolvePhase9MapModEffects(mapDef, 'bsp_fortress');

    const cols = 76 + Math.min(22, progression * 3);
    const rows = 48 + Math.min(16, progression * 2);
    const tiles = Array.from({ length: rows }, () => Array(cols).fill(1));

    const root = { x: 2, y: 2, w: cols - 4, h: rows - 4 };
    const leaves = [];
    const maxDepth = Math.max(3, 4 + (mapModEffects.pre.bspMaxDepthDelta ?? 0));
    const minLeaf = Math.max(11, 13 + (mapModEffects.pre.bspMinLeafDelta ?? 0));

    function split(node, depth) {
      const canSplitH = node.h >= minLeaf * 2;
      const canSplitV = node.w >= minLeaf * 2;
      if (depth >= maxDepth || (!canSplitH && !canSplitV)) {
        leaves.push(node);
        return;
      }

      let vertical;
      if (canSplitH && canSplitV) {
        if (node.w / node.h > 1.22) vertical = true;
        else if (node.h / node.w > 1.22) vertical = false;
        else vertical = rng() > 0.5;
      } else {
        vertical = canSplitV;
      }

      if (vertical) {
        const cut = randInt(rng, minLeaf, node.w - minLeaf);
        split({ x: node.x, y: node.y, w: cut, h: node.h }, depth + 1);
        split({ x: node.x + cut, y: node.y, w: node.w - cut, h: node.h }, depth + 1);
      } else {
        const cut = randInt(rng, minLeaf, node.h - minLeaf);
        split({ x: node.x, y: node.y, w: node.w, h: cut }, depth + 1);
        split({ x: node.x, y: node.y + cut, w: node.w, h: node.h - cut }, depth + 1);
      }
    }

    split(root, 0);

    const baseRooms = [];
    for (const leaf of leaves) {
      const room = createRoomForLeaf(leaf, rng, {
        forceRoomShapePool: mapModEffects.pre.forceRoomShapePool,
      });
      carveRoomShape(tiles, rows, cols, room, rng);
      baseRooms.push(room);
    }

    const corridorWidths = [];
    const corridorMin = Math.max(1, mapModEffects.pre.corridorWidthMin ?? 1);
    const corridorMax = Math.max(corridorMin, mapModEffects.pre.corridorWidthMax ?? 3);
    for (let i = 0; i < baseRooms.length - 1; i++) {
      const a = baseRooms[i];
      const b = baseRooms[i + 1];
      const width = randInt(rng, corridorMin, corridorMax);
      corridorWidths.push(width);
      carveCorridor(
        tiles,
        rows,
        cols,
        a.x + Math.floor(a.w / 2),
        a.y + Math.floor(a.h / 2),
        b.x + Math.floor(b.w / 2),
        b.y + Math.floor(b.h / 2),
        width,
        rng,
      );
    }

    const fallbackRoom = {
      x: Math.floor(cols / 2) - 4,
      y: Math.floor(rows / 2) - 4,
      w: 8,
      h: 8,
      shape: 'rect',
    };
    const startRoomBase = baseRooms[Math.floor(rng() * baseRooms.length)] ?? fallbackRoom;

    let bossRoomBase = startRoomBase;
    let farthestSq = -1;
    for (const room of baseRooms) {
      const dx = (room.x + Math.floor(room.w / 2)) - (startRoomBase.x + Math.floor(startRoomBase.w / 2));
      const dy = (room.y + Math.floor(room.h / 2)) - (startRoomBase.y + Math.floor(startRoomBase.h / 2));
      const dSq = dx * dx + dy * dy;
      if (dSq > farthestSq) {
        farthestSq = dSq;
        bossRoomBase = room;
      }
    }

    const typedRooms = buildTypedRooms(baseRooms, startRoomBase, bossRoomBase, rng);
    const startRoom = typedRooms.find((r) => r.type === 'start') ?? typedRooms[0] ?? {
      ...fallbackRoom,
      id: 'room_0',
      roomShape: 'rect',
      bossArenaStyle: null,
      type: 'start',
      centerX: fallbackRoom.x + Math.floor(fallbackRoom.w / 2),
      centerY: fallbackRoom.y + Math.floor(fallbackRoom.h / 2),
    };
    const bossRoom = typedRooms.find((r) => r.type === 'boss') ?? startRoom;

    const obstacleMask = new Uint8Array(cols * rows);
    const obstacleOccupancyMask = new Uint8Array(cols * rows);
    const obstacles = [];
    applyBossArenaTemplate(bossRoom, tiles, cols, rows, rng, obstacleMask, obstacleOccupancyMask, obstacles);
    seedCombatObstacles(typedRooms, tiles, cols, rows, rng, obstacleMask, obstacleOccupancyMask, obstacles);
    const terrain = seedSoftTerrain(typedRooms, tiles, cols, rows, rng, obstacleOccupancyMask, mapDef, mapModEffects.post);
    const encounterMetadata = buildEncounterMetadata(typedRooms, startRoom, bossRoom, mapDef);
    const corruptionVariant = applyPhase9CorruptionVariant({
      bossRoom,
      typedRooms,
      encounterMetadata,
      modEffects: mapModEffects,
      rng,
    });
    const phase9Notes = applyPhase9PostGenerationDecor({
      typedRooms,
      tiles,
      cols,
      rows,
      rng,
      obstacleMask,
      obstacleOccupancyMask,
      obstacles,
      terrainMask: terrain.terrainMask,
      encounterMetadata,
      modEffects: mapModEffects,
    });
    const phase9SummaryNotes = corruptionVariant
      ? [...phase9Notes, `Corrupted boss arena variant: ${corruptionVariant}.`]
      : phase9Notes;

    const startTile = { tx: startRoom.centerX, ty: startRoom.centerY };
    const worldLeft = -(cols * TILE_SIZE) / 2;
    const worldTop = -(rows * TILE_SIZE) / 2;

    const toWorld = (tx, ty) => ({
      x: worldLeft + tx * TILE_SIZE + TILE_SIZE * 0.5,
      y: worldTop + ty * TILE_SIZE + TILE_SIZE * 0.5,
    });

    const map = {
      seed,
      mapId: mapDef?.id ?? 'unknown',
      tier: mapDef?.tier ?? 1,
      tileSize: TILE_SIZE,
      cols,
      rows,
      widthPx: cols * TILE_SIZE,
      heightPx: rows * TILE_SIZE,
      worldLeft,
      worldTop,
      tiles,
      obstacleMask,
      obstacleOccupancyMask,
      terrainMask: terrain.terrainMask,
      terrainPalette: terrain.terrainPalette,
      terrainDefs: TERRAIN_DEFS,
      obstacles,
      encounterMetadata,
      mapModMetadata: {
        activeModIds: mapModEffects.activeModIds,
        hybridRemix: mapModEffects.hybridRemix,
        bossArenaCorruptionVariant: corruptionVariant ?? null,
        preGeneration: mapModEffects.pre,
        postGeneration: mapModEffects.post,
        notes: [...mapModEffects.notes, ...phase9SummaryNotes],
      },
      corridorWidths,
      rooms: typedRooms,
      startRoom,
      bossRoom,
      clusterRooms: typedRooms.filter((r) => r.type !== 'start' && r.type !== 'boss'),
      startTile,
      startWorld: toWorld(startTile.tx, startTile.ty),
      roomShapePalette: {
        rect: '#223043',
        clipped: '#24354b',
        pill: '#263851',
        offset: '#2a3d57',
        courtyard: '#2c425f',
        hall: '#23364d',
      },
      bossArenaPalette: {
        duel_circle: '#466b8d',
        pillar_hall: '#6d6aa8',
        throne_dais: '#8f6f48',
        broken_arena: '#7b5353',
        chapel_cross: '#5b7f7c',
      },

      isWall(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return true;
        return tiles[ty][tx] === 1 || obstacleMask[keyOf(tx, ty, cols)] === 1;
      },

      isWalkableTile(tx, ty) {
        return !this.isWall(tx, ty);
      },

      terrainCodeAtTile(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return TERRAIN_CODE.NONE;
        return this.terrainMask[keyOf(tx, ty, cols)] ?? TERRAIN_CODE.NONE;
      },

      terrainTypeAtTile(tx, ty) {
        const code = this.terrainCodeAtTile(tx, ty);
        return this.terrainDefs?.[code]?.id ?? null;
      },

      terrainSpeedMultiplierAtTile(tx, ty) {
        const code = this.terrainCodeAtTile(tx, ty);
        return this.terrainDefs?.[code]?.speedMult ?? 1;
      },

      worldToTile(x, y) {
        const tx = Math.floor((x - worldLeft) / TILE_SIZE);
        const ty = Math.floor((y - worldTop) / TILE_SIZE);
        return { tx, ty };
      },

      tileToWorld(tx, ty) {
        return toWorld(tx, ty);
      },

      isWalkableWorld(x, y) {
        const { tx, ty } = this.worldToTile(x, y);
        return this.isWalkableTile(tx, ty);
      },

      findSpawnPointNear(player, minR = 240, maxR = 760) {
        const minSq = minR * minR;
        const maxSq = maxR * maxR;

        for (let i = 0; i < 120; i++) {
          const pickTile = this.floorTiles[Math.floor(rng() * this.floorTiles.length)];
          if (!pickTile) break;
          const point = toWorld(pickTile.tx, pickTile.ty);
          const dx = point.x - player.x;
          const dy = point.y - player.y;
          const dSq = dx * dx + dy * dy;
          if (dSq >= minSq && dSq <= maxSq) return point;
        }

        const fallback = this.floorTiles[Math.floor(rng() * this.floorTiles.length)] ?? startTile;
        return toWorld(fallback.tx, fallback.ty);
      },
    };

    map.floorTiles = buildFloorTileLists(typedRooms, map, obstacleMask, obstacleOccupancyMask, terrain.terrainMask);
    return map;
  }

  static _generateMeanderingCavernLayout(mapDef, seed) {
    const rng = mulberry32(seed >>> 0);
    const areaLevel = Math.max(1, mapDef?.areaLevel ?? mapDef?.sourceMapItemLevel ?? 1);
    const progression = Math.max(1, Math.floor((areaLevel + 1) / 12));
    const mapModEffects = resolvePhase9MapModEffects(mapDef, 'meandering_cavern');

    const cols = 74 + Math.min(22, progression * 3);
    const rows = 50 + Math.min(18, progression * 2);
    const tiles = Array.from({ length: rows }, () => Array(cols).fill(1));

    const chamberCount = Math.max(5, Math.min(12, 5 + Math.floor(progression / 2) + (mapModEffects.pre.laneCountDelta ?? 0)));
    const chambers = [];
    const chamberTiles = [];

    for (let i = 0; i < chamberCount; i++) {
      const radius = randInt(rng, 4, 7);
      const cx = randInt(rng, 8, cols - 9);
      const cy = randInt(rng, 8, rows - 9);
      const tilesForRoom = [];
      for (let ty = cy - radius - 1; ty <= cy + radius + 1; ty++) {
        for (let tx = cx - radius - 1; tx <= cx + radius + 1; tx++) {
          if (tx < 1 || ty < 1 || tx >= cols - 1 || ty >= rows - 1) continue;
          const dx = tx - cx;
          const dy = ty - cy;
          const wobble = 0.86 + rng() * 0.34;
          if ((dx * dx + dy * dy) <= radius * radius * wobble) {
            tiles[ty][tx] = 0;
            tilesForRoom.push({ tx, ty });
          }
        }
      }
      chambers.push({ x: cx, y: cy, radius });
      chamberTiles.push(tilesForRoom);
    }

    // Connect chambers in nearest-neighbor order with curved tunnel worms.
    const connected = new Set([0]);
    while (connected.size < chambers.length) {
      let bestA = -1;
      let bestB = -1;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const aIdx of connected) {
        for (let bIdx = 0; bIdx < chambers.length; bIdx++) {
          if (connected.has(bIdx)) continue;
          const a = chambers[aIdx];
          const b = chambers[bIdx];
          const dist = (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
          if (dist < bestDist) {
            bestDist = dist;
            bestA = aIdx;
            bestB = bIdx;
          }
        }
      }
      if (bestA >= 0 && bestB >= 0) {
        carveWormTunnel(
          tiles,
          rows,
          cols,
          chambers[bestA],
          chambers[bestB],
          rng,
          1.3 * (mapModEffects.pre.cavernRadiusMult ?? 1),
          2.35 * (mapModEffects.pre.cavernRadiusMult ?? 1),
        );
        connected.add(bestB);
      } else {
        break;
      }
    }

    // Add a few extra loops so caves do not feel linear.
    const extraLoops = Math.max(1, Math.floor((chambers.length / 3) * (mapModEffects.pre.cavernExtraLoopsMult ?? 1)));
    for (let i = 0; i < extraLoops; i++) {
      const aIdx = randInt(rng, 0, chambers.length - 1);
      let bIdx = randInt(rng, 0, chambers.length - 1);
      if (aIdx === bIdx) bIdx = (bIdx + 1) % chambers.length;
      carveWormTunnel(
        tiles,
        rows,
        cols,
        chambers[aIdx],
        chambers[bIdx],
        rng,
        1.1 * (mapModEffects.pre.cavernRadiusMult ?? 1),
        2.0 * (mapModEffects.pre.cavernRadiusMult ?? 1),
      );
    }

    smoothCavernTiles(tiles, rows, cols, 1);

    const startIdx = randInt(rng, 0, chambers.length - 1);
    const startChamber = chambers[startIdx];
    let bossIdx = startIdx;
    let farthest = -1;
    for (let i = 0; i < chambers.length; i++) {
      const c = chambers[i];
      const d = (c.x - startChamber.x) * (c.x - startChamber.x) + (c.y - startChamber.y) * (c.y - startChamber.y);
      if (d > farthest) {
        farthest = d;
        bossIdx = i;
      }
    }

    const typedRooms = chamberTiles.map((tilesForRoom, idx) => {
      const kind = idx === startIdx ? 'start' : idx === bossIdx ? 'boss' : (rng() < 0.18 ? 'elite' : (rng() < 0.2 ? 'treasure' : 'combat'));
      return buildRoomBoundsFromTiles(`room_${idx}`, kind, 'cavern_chamber', tilesForRoom);
    });

    const startRoom = typedRooms.find((r) => r.type === 'start') ?? typedRooms[0];
    const bossRoom = typedRooms.find((r) => r.type === 'boss') ?? typedRooms[typedRooms.length - 1];

    const obstacleMask = new Uint8Array(cols * rows);
    const obstacleOccupancyMask = new Uint8Array(cols * rows);
    const obstacles = [];
    applyBossArenaTemplate(bossRoom, tiles, cols, rows, rng, obstacleMask, obstacleOccupancyMask, obstacles);
    seedCombatObstacles(typedRooms, tiles, cols, rows, rng, obstacleMask, obstacleOccupancyMask, obstacles);
    const terrain = seedSoftTerrain(typedRooms, tiles, cols, rows, rng, obstacleOccupancyMask, mapDef, mapModEffects.post);
    const encounterMetadata = buildEncounterMetadata(typedRooms, startRoom, bossRoom, mapDef);
    const corruptionVariant = applyPhase9CorruptionVariant({
      bossRoom,
      typedRooms,
      encounterMetadata,
      modEffects: mapModEffects,
      rng,
    });
    const phase9Notes = applyPhase9PostGenerationDecor({
      typedRooms,
      tiles,
      cols,
      rows,
      rng,
      obstacleMask,
      obstacleOccupancyMask,
      obstacles,
      terrainMask: terrain.terrainMask,
      encounterMetadata,
      modEffects: mapModEffects,
    });
    const phase9SummaryNotes = corruptionVariant
      ? [...phase9Notes, `Corrupted boss arena variant: ${corruptionVariant}.`]
      : phase9Notes;

    const startTile = { tx: startRoom.centerX, ty: startRoom.centerY };
    const worldLeft = -(cols * TILE_SIZE) / 2;
    const worldTop = -(rows * TILE_SIZE) / 2;

    const toWorld = (tx, ty) => ({
      x: worldLeft + tx * TILE_SIZE + TILE_SIZE * 0.5,
      y: worldTop + ty * TILE_SIZE + TILE_SIZE * 0.5,
    });

    const map = {
      seed,
      mapId: mapDef?.id ?? 'unknown',
      tier: mapDef?.tier ?? 1,
      tileSize: TILE_SIZE,
      cols,
      rows,
      widthPx: cols * TILE_SIZE,
      heightPx: rows * TILE_SIZE,
      worldLeft,
      worldTop,
      tiles,
      obstacleMask,
      obstacleOccupancyMask,
      terrainMask: terrain.terrainMask,
      terrainPalette: terrain.terrainPalette,
      terrainDefs: TERRAIN_DEFS,
      obstacles,
      encounterMetadata,
      mapModMetadata: {
        activeModIds: mapModEffects.activeModIds,
        hybridRemix: mapModEffects.hybridRemix,
        bossArenaCorruptionVariant: corruptionVariant ?? null,
        preGeneration: mapModEffects.pre,
        postGeneration: mapModEffects.post,
        notes: [...mapModEffects.notes, ...phase9SummaryNotes],
      },
      corridorWidths: [],
      rooms: typedRooms,
      startRoom,
      bossRoom,
      clusterRooms: typedRooms.filter((r) => r.type !== 'start' && r.type !== 'boss'),
      startTile,
      startWorld: toWorld(startTile.tx, startTile.ty),
      roomShapePalette: {
        cavern_chamber: '#35514a',
        rect: '#223043',
        clipped: '#24354b',
        pill: '#263851',
        offset: '#2a3d57',
        courtyard: '#2c425f',
        hall: '#23364d',
      },
      bossArenaPalette: {
        duel_circle: '#466b8d',
        pillar_hall: '#6d6aa8',
        throne_dais: '#8f6f48',
        broken_arena: '#7b5353',
        chapel_cross: '#5b7f7c',
      },

      isWall(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return true;
        return tiles[ty][tx] === 1 || obstacleMask[keyOf(tx, ty, cols)] === 1;
      },

      isWalkableTile(tx, ty) {
        return !this.isWall(tx, ty);
      },

      terrainCodeAtTile(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return TERRAIN_CODE.NONE;
        return this.terrainMask[keyOf(tx, ty, cols)] ?? TERRAIN_CODE.NONE;
      },

      terrainTypeAtTile(tx, ty) {
        const code = this.terrainCodeAtTile(tx, ty);
        return this.terrainDefs?.[code]?.id ?? null;
      },

      terrainSpeedMultiplierAtTile(tx, ty) {
        const code = this.terrainCodeAtTile(tx, ty);
        return this.terrainDefs?.[code]?.speedMult ?? 1;
      },

      worldToTile(x, y) {
        const tx = Math.floor((x - worldLeft) / TILE_SIZE);
        const ty = Math.floor((y - worldTop) / TILE_SIZE);
        return { tx, ty };
      },

      tileToWorld(tx, ty) {
        return toWorld(tx, ty);
      },

      isWalkableWorld(x, y) {
        const { tx, ty } = this.worldToTile(x, y);
        return this.isWalkableTile(tx, ty);
      },

      findSpawnPointNear(player, minR = 240, maxR = 760) {
        const minSq = minR * minR;
        const maxSq = maxR * maxR;

        for (let i = 0; i < 140; i++) {
          const pickTile = this.floorTiles[Math.floor(rng() * this.floorTiles.length)];
          if (!pickTile) break;
          const point = toWorld(pickTile.tx, pickTile.ty);
          const dx = point.x - player.x;
          const dy = point.y - player.y;
          const dSq = dx * dx + dy * dy;
          if (dSq >= minSq && dSq <= maxSq) return point;
        }

        const fallback = this.floorTiles[Math.floor(rng() * this.floorTiles.length)] ?? startTile;
        return toWorld(fallback.tx, fallback.ty);
      },
    };

    map.floorTiles = buildFloorTileLists(typedRooms, map, obstacleMask, obstacleOccupancyMask, terrain.terrainMask);
    return map;
  }

  static _generateGauntletLaneLayout(mapDef, seed) {
    const rng = mulberry32(seed >>> 0);
    const areaLevel = Math.max(1, mapDef?.areaLevel ?? mapDef?.sourceMapItemLevel ?? 1);
    const progression = Math.max(1, Math.floor((areaLevel + 1) / 12));
    const mapModEffects = resolvePhase9MapModEffects(mapDef, 'gauntlet_lane');

    const cols = 78 + Math.min(20, progression * 3);
    const rows = 44 + Math.min(14, progression * 2);
    const tiles = Array.from({ length: rows }, () => Array(cols).fill(1));

    const laneCount = Math.max(6, Math.min(11, 6 + Math.floor(progression / 3) + (mapModEffects.pre.laneCountDelta ?? 0)));
    const startX = 8;
    const endX = cols - 9;
    const baseY = Math.floor(rows / 2);
    const midPocketIndex = Math.floor(laneCount / 2);
    const chokepointSegment = Math.max(1, midPocketIndex - 1);

    const pockets = [];
    for (let i = 0; i < laneCount; i++) {
      const t = laneCount <= 1 ? 0 : i / (laneCount - 1);
      const x = Math.round(startX + (endX - startX) * t + randInt(rng, -1, 1));
      const yDrift = Math.round(Math.sin(t * Math.PI * 1.35) * (3 + (mapModEffects.pre.laneDriftBoost ?? 0)));
      const y = Math.max(8, Math.min(rows - 9, baseY + yDrift + randInt(rng, -1, 1)));

      let radius = randInt(rng, 3, 4);
      if (i === 0) radius = 5;
      if (i === laneCount - 1) radius = 7;
      if (i === midPocketIndex) radius = 6;

      pockets.push({
        id: `room_${i}`,
        index: i,
        centerX: x,
        centerY: y,
        radius,
      });
    }

    for (let i = 0; i < pockets.length - 1; i++) {
      const from = pockets[i];
      const to = pockets[i + 1];
      const isChokepoint = i === chokepointSegment;
      const tightness = Math.max(0.9, mapModEffects.pre.chokepointTightness ?? 1);
      const minRadius = isChokepoint ? 1.05 / tightness : 1.45;
      const maxRadius = isChokepoint ? 1.35 / tightness : 2.05;
      carveWormTunnel(tiles, rows, cols, from, to, rng, minRadius, maxRadius);

      if (!isChokepoint && i % 2 === 1) {
        const mx = Math.round((from.centerX + to.centerX) / 2);
        const my = Math.round((from.centerY + to.centerY) / 2);
        carveDisk(tiles, rows, cols, mx, my, randInt(rng, 2, 3), 0);
      }
    }

    for (const pocket of pockets) {
      carveDisk(tiles, rows, cols, pocket.centerX, pocket.centerY, pocket.radius, 0);
    }

    const startPocket = pockets[0];
    carveRect(
      tiles,
      rows,
      cols,
      startPocket.centerX - 4,
      startPocket.centerY - 3,
      8,
      6,
      0,
    );

    const bossPocket = pockets[pockets.length - 1];
    carveRect(
      tiles,
      rows,
      cols,
      bossPocket.centerX - 6,
      bossPocket.centerY - 5,
      12,
      10,
      0,
    );

    const typedRooms = pockets.map((pocket) => {
      let type = 'combat';
      if (pocket.index === 0) type = 'start';
      else if (pocket.index === pockets.length - 1) type = 'boss';
      else if (pocket.index === midPocketIndex) type = 'elite';
      else if (rng() < 0.12) type = 'treasure';

      const room = {
        id: pocket.id,
        x: Math.max(1, pocket.centerX - pocket.radius - 1),
        y: Math.max(1, pocket.centerY - pocket.radius - 1),
        w: Math.min(cols - 2, pocket.centerX + pocket.radius + 1) - Math.max(1, pocket.centerX - pocket.radius - 1) + 1,
        h: Math.min(rows - 2, pocket.centerY + pocket.radius + 1) - Math.max(1, pocket.centerY - pocket.radius - 1) + 1,
        centerX: pocket.centerX,
        centerY: pocket.centerY,
        roomShape: 'lane_pocket',
        bossArenaStyle: null,
        type,
      };

      if (type === 'boss') {
        room.x = Math.max(1, pocket.centerX - 7);
        room.y = Math.max(1, pocket.centerY - 6);
        room.w = Math.min(cols - 2, pocket.centerX + 7) - room.x + 1;
        room.h = Math.min(rows - 2, pocket.centerY + 6) - room.y + 1;
      }

      return room;
    });

    const startRoom = typedRooms.find((r) => r.type === 'start') ?? typedRooms[0];
    const bossRoom = typedRooms.find((r) => r.type === 'boss') ?? typedRooms[typedRooms.length - 1];

    const obstacleMask = new Uint8Array(cols * rows);
    const obstacleOccupancyMask = new Uint8Array(cols * rows);
    const obstacles = [];
    applyBossArenaTemplate(bossRoom, tiles, cols, rows, rng, obstacleMask, obstacleOccupancyMask, obstacles);
    seedCombatObstacles(typedRooms, tiles, cols, rows, rng, obstacleMask, obstacleOccupancyMask, obstacles);
    const terrain = seedSoftTerrain(typedRooms, tiles, cols, rows, rng, obstacleOccupancyMask, mapDef, mapModEffects.post);
    const encounterMetadata = buildEncounterMetadata(typedRooms, startRoom, bossRoom, mapDef);
    const corruptionVariant = applyPhase9CorruptionVariant({
      bossRoom,
      typedRooms,
      encounterMetadata,
      modEffects: mapModEffects,
      rng,
    });
    const phase9Notes = applyPhase9PostGenerationDecor({
      typedRooms,
      tiles,
      cols,
      rows,
      rng,
      obstacleMask,
      obstacleOccupancyMask,
      obstacles,
      terrainMask: terrain.terrainMask,
      encounterMetadata,
      modEffects: mapModEffects,
    });
    const phase9SummaryNotes = corruptionVariant
      ? [...phase9Notes, `Corrupted boss arena variant: ${corruptionVariant}.`]
      : phase9Notes;

    const startTile = { tx: startRoom.centerX, ty: startRoom.centerY };
    const worldLeft = -(cols * TILE_SIZE) / 2;
    const worldTop = -(rows * TILE_SIZE) / 2;

    const toWorld = (tx, ty) => ({
      x: worldLeft + tx * TILE_SIZE + TILE_SIZE * 0.5,
      y: worldTop + ty * TILE_SIZE + TILE_SIZE * 0.5,
    });

    const map = {
      seed,
      mapId: mapDef?.id ?? 'unknown',
      tier: mapDef?.tier ?? 1,
      tileSize: TILE_SIZE,
      cols,
      rows,
      widthPx: cols * TILE_SIZE,
      heightPx: rows * TILE_SIZE,
      worldLeft,
      worldTop,
      tiles,
      obstacleMask,
      obstacleOccupancyMask,
      terrainMask: terrain.terrainMask,
      terrainPalette: terrain.terrainPalette,
      terrainDefs: TERRAIN_DEFS,
      obstacles,
      encounterMetadata,
      mapModMetadata: {
        activeModIds: mapModEffects.activeModIds,
        hybridRemix: mapModEffects.hybridRemix,
        bossArenaCorruptionVariant: corruptionVariant ?? null,
        preGeneration: mapModEffects.pre,
        postGeneration: mapModEffects.post,
        notes: [...mapModEffects.notes, ...phase9SummaryNotes],
      },
      corridorWidths: [2, 1, 2],
      rooms: typedRooms,
      startRoom,
      bossRoom,
      clusterRooms: typedRooms.filter((r) => r.type !== 'start' && r.type !== 'boss'),
      startTile,
      startWorld: toWorld(startTile.tx, startTile.ty),
      roomShapePalette: {
        lane_pocket: '#4b4e62',
        rect: '#223043',
        clipped: '#24354b',
        pill: '#263851',
        offset: '#2a3d57',
        courtyard: '#2c425f',
        hall: '#23364d',
      },
      bossArenaPalette: {
        duel_circle: '#466b8d',
        pillar_hall: '#6d6aa8',
        throne_dais: '#8f6f48',
        broken_arena: '#7b5353',
        chapel_cross: '#5b7f7c',
      },

      isWall(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return true;
        return tiles[ty][tx] === 1 || obstacleMask[keyOf(tx, ty, cols)] === 1;
      },

      isWalkableTile(tx, ty) {
        return !this.isWall(tx, ty);
      },

      terrainCodeAtTile(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return TERRAIN_CODE.NONE;
        return this.terrainMask[keyOf(tx, ty, cols)] ?? TERRAIN_CODE.NONE;
      },

      terrainTypeAtTile(tx, ty) {
        const code = this.terrainCodeAtTile(tx, ty);
        return this.terrainDefs?.[code]?.id ?? null;
      },

      terrainSpeedMultiplierAtTile(tx, ty) {
        const code = this.terrainCodeAtTile(tx, ty);
        return this.terrainDefs?.[code]?.speedMult ?? 1;
      },

      worldToTile(x, y) {
        const tx = Math.floor((x - worldLeft) / TILE_SIZE);
        const ty = Math.floor((y - worldTop) / TILE_SIZE);
        return { tx, ty };
      },

      tileToWorld(tx, ty) {
        return toWorld(tx, ty);
      },

      isWalkableWorld(x, y) {
        const { tx, ty } = this.worldToTile(x, y);
        return this.isWalkableTile(tx, ty);
      },

      findSpawnPointNear(player, minR = 240, maxR = 760) {
        const minSq = minR * minR;
        const maxSq = maxR * maxR;

        for (let i = 0; i < 130; i++) {
          const pickTile = this.floorTiles[Math.floor(rng() * this.floorTiles.length)];
          if (!pickTile) break;
          const point = toWorld(pickTile.tx, pickTile.ty);
          const dx = point.x - player.x;
          const dy = point.y - player.y;
          const dSq = dx * dx + dy * dy;
          if (dSq >= minSq && dSq <= maxSq) return point;
        }

        const fallback = this.floorTiles[Math.floor(rng() * this.floorTiles.length)] ?? startTile;
        return toWorld(fallback.tx, fallback.ty);
      },
    };

    map.floorTiles = buildFloorTileLists(typedRooms, map, obstacleMask, obstacleOccupancyMask, terrain.terrainMask);
    return map;
  }

  static _generateOpenFieldsLayout(mapDef, seed) {
    const rng = mulberry32(seed >>> 0);
    const areaLevel = Math.max(1, mapDef?.areaLevel ?? mapDef?.sourceMapItemLevel ?? 1);
    const progression = Math.max(1, Math.floor((areaLevel + 1) / 12));
    const mapModEffects = resolvePhase9MapModEffects(mapDef, 'open_fields');

    const cols = 88 + Math.min(20, progression * 3);
    const rows = 54 + Math.min(14, progression * 2);
    const tiles = Array.from({ length: rows }, () => Array(cols).fill(1));

    const leftRoom = {
      id: 'room_0',
      x: 6,
      y: 6,
      w: Math.max(30, Math.floor(cols * 0.56)),
      h: Math.max(26, Math.floor(rows * 0.66)),
      roomShape: 'field_basin',
    };
    const overlapShiftX = Math.max(8, Math.floor(cols * 0.22)) + randInt(rng, -3, 3);
    const overlapShiftY = Math.max(2, Math.floor(rows * 0.06)) + randInt(rng, -2, 2);
    const rightRoom = {
      id: 'room_1',
      x: Math.min(cols - 8, leftRoom.x + overlapShiftX),
      y: Math.min(rows - 8, leftRoom.y + overlapShiftY),
      w: Math.max(28, Math.floor(cols * 0.5)),
      h: Math.max(24, Math.floor(rows * 0.62)),
      roomShape: 'field_basin',
    };

    carveRect(tiles, rows, cols, leftRoom.x, leftRoom.y, leftRoom.w, leftRoom.h, 0);
    carveRect(tiles, rows, cols, rightRoom.x, rightRoom.y, rightRoom.w, rightRoom.h, 0);
    carveDisk(
      tiles,
      rows,
      cols,
      leftRoom.x + Math.floor(leftRoom.w * 0.72),
      leftRoom.y + Math.floor(leftRoom.h * 0.5),
      9,
      0,
    );
    carveDisk(
      tiles,
      rows,
      cols,
      rightRoom.x + Math.floor(rightRoom.w * 0.28),
      rightRoom.y + Math.floor(rightRoom.h * 0.5),
      9,
      0,
    );

    const bridgeWidth = Math.max(3, Math.min(6, mapModEffects.pre.corridorWidthMax ?? 5));
    carveCorridor(
      tiles,
      rows,
      cols,
      leftRoom.x + Math.floor(leftRoom.w * 0.78),
      leftRoom.y + Math.floor(leftRoom.h / 2),
      rightRoom.x + Math.floor(rightRoom.w * 0.22),
      rightRoom.y + Math.floor(rightRoom.h / 2),
      bridgeWidth,
      rng,
    );

    const pocketRoom = {
      id: 'room_2',
      x: Math.max(3, Math.floor(cols * 0.08)),
      y: Math.max(3, rows - Math.floor(rows * 0.26)),
      w: Math.max(14, Math.floor(cols * 0.2)),
      h: Math.max(10, Math.floor(rows * 0.16)),
      roomShape: 'field_pocket',
    };
    carveRect(tiles, rows, cols, pocketRoom.x, pocketRoom.y, pocketRoom.w, pocketRoom.h, 0);
    carveCorridor(
      tiles,
      rows,
      cols,
      pocketRoom.x + Math.floor(pocketRoom.w * 0.8),
      pocketRoom.y + Math.floor(pocketRoom.h * 0.45),
      leftRoom.x + Math.floor(leftRoom.w * 0.2),
      leftRoom.y + Math.floor(leftRoom.h * 0.75),
      2,
      rng,
    );

    const typedRooms = [
      {
        ...leftRoom,
        x: leftRoom.x,
        y: leftRoom.y,
        w: leftRoom.w,
        h: leftRoom.h,
        centerX: leftRoom.x + Math.floor(leftRoom.w / 2),
        centerY: leftRoom.y + Math.floor(leftRoom.h / 2),
        bossArenaStyle: null,
        type: 'start',
      },
      {
        ...rightRoom,
        x: rightRoom.x,
        y: rightRoom.y,
        w: rightRoom.w,
        h: rightRoom.h,
        centerX: rightRoom.x + Math.floor(rightRoom.w / 2),
        centerY: rightRoom.y + Math.floor(rightRoom.h / 2),
        bossArenaStyle: null,
        type: 'boss',
      },
      {
        ...pocketRoom,
        x: pocketRoom.x,
        y: pocketRoom.y,
        w: pocketRoom.w,
        h: pocketRoom.h,
        centerX: pocketRoom.x + Math.floor(pocketRoom.w / 2),
        centerY: pocketRoom.y + Math.floor(pocketRoom.h / 2),
        bossArenaStyle: null,
        type: rng() < 0.5 ? 'elite' : 'combat',
      },
    ];

    const startRoom = typedRooms[0];
    const bossRoom = typedRooms[1];

    const obstacleMask = new Uint8Array(cols * rows);
    const obstacleOccupancyMask = new Uint8Array(cols * rows);
    const obstacles = [];
    applyBossArenaTemplate(bossRoom, tiles, cols, rows, rng, obstacleMask, obstacleOccupancyMask, obstacles);

    const reserved = new Set();
    reserveArea(reserved, startRoom, cols, rows, 2);
    reserveArea(reserved, bossRoom, cols, rows, 2);
    for (const room of typedRooms) {
      if (room.type === 'start' || room.type === 'boss') continue;
      const sparseCount = randInt(rng, 1, 2);
      for (let i = 0; i < sparseCount; i++) {
        const tx = randInt(rng, room.x + 1, room.x + room.w - 2);
        const ty = randInt(rng, room.y + 1, room.y + room.h - 2);
        const type = rng() < 0.7 ? 'pillar' : 'rubble';
        const footprint = type === 'rubble' ? makeFootprint(tx, ty, [[0, 0], [1, 0]]) : [{ tx, ty }];
        placeObstacle(obstacles, obstacleMask, obstacleOccupancyMask, tiles, cols, rows, room, type, footprint, { reserved });
      }
    }

    const terrain = seedSoftTerrain(typedRooms, tiles, cols, rows, rng, obstacleOccupancyMask, mapDef, mapModEffects.post);
    const encounterMetadata = buildEncounterMetadata(typedRooms, startRoom, bossRoom, mapDef);
    const corruptionVariant = applyPhase9CorruptionVariant({
      bossRoom,
      typedRooms,
      encounterMetadata,
      modEffects: mapModEffects,
      rng,
    });
    const phase9Notes = applyPhase9PostGenerationDecor({
      typedRooms,
      tiles,
      cols,
      rows,
      rng,
      obstacleMask,
      obstacleOccupancyMask,
      obstacles,
      terrainMask: terrain.terrainMask,
      encounterMetadata,
      modEffects: mapModEffects,
    });
    const phase9SummaryNotes = corruptionVariant
      ? [...phase9Notes, `Corrupted boss arena variant: ${corruptionVariant}.`]
      : phase9Notes;

    const startTile = { tx: startRoom.centerX, ty: startRoom.centerY };
    const worldLeft = -(cols * TILE_SIZE) / 2;
    const worldTop = -(rows * TILE_SIZE) / 2;

    const toWorld = (tx, ty) => ({
      x: worldLeft + tx * TILE_SIZE + TILE_SIZE * 0.5,
      y: worldTop + ty * TILE_SIZE + TILE_SIZE * 0.5,
    });

    const map = {
      seed,
      mapId: mapDef?.id ?? 'unknown',
      tier: mapDef?.tier ?? 1,
      tileSize: TILE_SIZE,
      cols,
      rows,
      widthPx: cols * TILE_SIZE,
      heightPx: rows * TILE_SIZE,
      worldLeft,
      worldTop,
      tiles,
      obstacleMask,
      obstacleOccupancyMask,
      terrainMask: terrain.terrainMask,
      terrainPalette: terrain.terrainPalette,
      terrainDefs: TERRAIN_DEFS,
      obstacles,
      encounterMetadata,
      mapModMetadata: {
        activeModIds: mapModEffects.activeModIds,
        hybridRemix: mapModEffects.hybridRemix,
        bossArenaCorruptionVariant: corruptionVariant ?? null,
        preGeneration: mapModEffects.pre,
        postGeneration: mapModEffects.post,
        notes: [...mapModEffects.notes, ...phase9SummaryNotes, 'Fields layout emphasizes wide, intersecting open arenas.'],
      },
      corridorWidths: [bridgeWidth, 2],
      rooms: typedRooms,
      startRoom,
      bossRoom,
      clusterRooms: typedRooms.filter((r) => r.type !== 'start' && r.type !== 'boss'),
      startTile,
      startWorld: toWorld(startTile.tx, startTile.ty),
      roomShapePalette: {
        field_basin: '#4d6b4c',
        field_pocket: '#48604a',
        lane_pocket: '#4b4e62',
        rect: '#223043',
        clipped: '#24354b',
        pill: '#263851',
        offset: '#2a3d57',
        courtyard: '#2c425f',
        hall: '#23364d',
      },
      bossArenaPalette: {
        duel_circle: '#466b8d',
        pillar_hall: '#6d6aa8',
        throne_dais: '#8f6f48',
        broken_arena: '#7b5353',
        chapel_cross: '#5b7f7c',
      },

      isWall(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return true;
        return tiles[ty][tx] === 1 || obstacleMask[keyOf(tx, ty, cols)] === 1;
      },

      isWalkableTile(tx, ty) {
        return !this.isWall(tx, ty);
      },

      terrainCodeAtTile(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return TERRAIN_CODE.NONE;
        return this.terrainMask[keyOf(tx, ty, cols)] ?? TERRAIN_CODE.NONE;
      },

      terrainTypeAtTile(tx, ty) {
        const code = this.terrainCodeAtTile(tx, ty);
        return this.terrainDefs?.[code]?.id ?? null;
      },

      terrainSpeedMultiplierAtTile(tx, ty) {
        const code = this.terrainCodeAtTile(tx, ty);
        return this.terrainDefs?.[code]?.speedMult ?? 1;
      },

      worldToTile(x, y) {
        const tx = Math.floor((x - worldLeft) / TILE_SIZE);
        const ty = Math.floor((y - worldTop) / TILE_SIZE);
        return { tx, ty };
      },

      tileToWorld(tx, ty) {
        return toWorld(tx, ty);
      },

      isWalkableWorld(x, y) {
        const { tx, ty } = this.worldToTile(x, y);
        return this.isWalkableTile(tx, ty);
      },

      findSpawnPointNear(player, minR = 240, maxR = 760) {
        const minSq = minR * minR;
        const maxSq = maxR * maxR;

        for (let i = 0; i < 130; i++) {
          const pickTile = this.floorTiles[Math.floor(rng() * this.floorTiles.length)];
          if (!pickTile) break;
          const point = toWorld(pickTile.tx, pickTile.ty);
          const dx = point.x - player.x;
          const dy = point.y - player.y;
          const dSq = dx * dx + dy * dy;
          if (dSq >= minSq && dSq <= maxSq) return point;
        }

        const fallback = this.floorTiles[Math.floor(rng() * this.floorTiles.length)] ?? startTile;
        return toWorld(fallback.tx, fallback.ty);
      },
    };

    map.floorTiles = buildFloorTileLists(typedRooms, map, obstacleMask, obstacleOccupancyMask, terrain.terrainMask);
    return map;
  }
}