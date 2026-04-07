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

/**
 * MapGenerator (C4)
 * Produces a room-and-corridor tile map centered around world origin.
 */
export class MapGenerator {
  /**
   * @param {{ id: string, tier?: number }} mapDef
   * @param {number} [seed]
   */
  static generate(mapDef, seed = (Math.random() * 0xffffffff) >>> 0) {
    const rng = mulberry32(seed >>> 0);
    const tier = Math.max(1, mapDef?.tier ?? 1);

    const cols = 76 + Math.min(22, tier * 3);
    const rows = 48 + Math.min(16, tier * 2);

    const tiles = Array.from({ length: rows }, () => Array(cols).fill(1)); // 1=wall, 0=floor

    const root = { x: 2, y: 2, w: cols - 4, h: rows - 4 };
    const leaves = [];
    const maxDepth = 4;
    const minLeaf = 13;

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

    const rooms = [];

    function carveRect(x, y, w, h) {
      for (let ty = y; ty < y + h; ty++) {
        for (let tx = x; tx < x + w; tx++) {
          if (ty >= 0 && ty < rows && tx >= 0 && tx < cols) tiles[ty][tx] = 0;
        }
      }
    }

    for (const leaf of leaves) {
      const roomW = randInt(rng, 6, Math.max(6, leaf.w - 2));
      const roomH = randInt(rng, 6, Math.max(6, leaf.h - 2));
      const roomX = randInt(rng, leaf.x + 1, leaf.x + leaf.w - roomW - 1);
      const roomY = randInt(rng, leaf.y + 1, leaf.y + leaf.h - roomH - 1);

      carveRect(roomX, roomY, roomW, roomH);

      rooms.push({
        x: roomX,
        y: roomY,
        w: roomW,
        h: roomH,
        centerX: roomX + Math.floor(roomW / 2),
        centerY: roomY + Math.floor(roomH / 2),
      });
    }

    function carveCorridor(ax, ay, bx, by) {
      const w = 2;
      if (rng() > 0.5) {
        carveRect(Math.min(ax, bx), ay - 1, Math.abs(bx - ax) + 1, w);
        carveRect(bx - 1, Math.min(ay, by), w, Math.abs(by - ay) + 1);
      } else {
        carveRect(ax - 1, Math.min(ay, by), w, Math.abs(by - ay) + 1);
        carveRect(Math.min(ax, bx), by - 1, Math.abs(bx - ax) + 1, w);
      }
    }

    for (let i = 0; i < rooms.length - 1; i++) {
      const a = rooms[i];
      const b = rooms[i + 1];
      carveCorridor(a.centerX, a.centerY, b.centerX, b.centerY);
    }

    const floorTiles = [];
    for (let ty = 1; ty < rows - 1; ty++) {
      for (let tx = 1; tx < cols - 1; tx++) {
        if (tiles[ty][tx] === 0) floorTiles.push({ tx, ty });
      }
    }

    const fallbackRoom = {
      x: Math.floor(cols / 2) - 4,
      y: Math.floor(rows / 2) - 4,
      w: 8,
      h: 8,
      centerX: Math.floor(cols / 2),
      centerY: Math.floor(rows / 2),
    };
    const startRoomBase = rooms[Math.floor(rng() * rooms.length)] ?? fallbackRoom;

    let bossRoomBase = startRoomBase;
    let farthestSq = -1;
    for (const room of rooms) {
      const dx = room.centerX - startRoomBase.centerX;
      const dy = room.centerY - startRoomBase.centerY;
      const dSq = dx * dx + dy * dy;
      if (dSq > farthestSq) {
        farthestSq = dSq;
        bossRoomBase = room;
      }
    }

    const typedRooms = rooms.map((room, idx) => ({
      id: `room_${idx}`,
      x: room.x,
      y: room.y,
      w: room.w,
      h: room.h,
      centerX: room.centerX,
      centerY: room.centerY,
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

    const startRoom = typedRooms.find((r) => r.type === 'start') ?? typedRooms[0] ?? {
      ...fallbackRoom,
      id: 'room_0',
      type: 'start',
    };
    const bossRoom = typedRooms.find((r) => r.type === 'boss') ?? startRoom;
    const clusterRooms = typedRooms.filter((r) => r.type !== 'start' && r.type !== 'boss');

    const startTile = { tx: startRoom.centerX, ty: startRoom.centerY };

    const worldLeft = -(cols * TILE_SIZE) / 2;
    const worldTop = -(rows * TILE_SIZE) / 2;

    const toWorld = (tx, ty) => ({
      x: worldLeft + tx * TILE_SIZE + TILE_SIZE * 0.5,
      y: worldTop + ty * TILE_SIZE + TILE_SIZE * 0.5,
    });

    const startWorld = toWorld(startTile.tx, startTile.ty);

    const map = {
      seed,
      mapId: mapDef?.id ?? 'unknown',
      tier,
      tileSize: TILE_SIZE,
      cols,
      rows,
      widthPx: cols * TILE_SIZE,
      heightPx: rows * TILE_SIZE,
      worldLeft,
      worldTop,
      tiles,
      rooms: typedRooms,
      startRoom,
      bossRoom,
      clusterRooms,
      floorTiles,
      startTile,
      startWorld,

      isWall(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return true;
        return tiles[ty][tx] === 1;
      },

      isWalkableTile(tx, ty) {
        return !this.isWall(tx, ty);
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

      /**
       * Pick a walkable spawn position around the player within min/max radius.
       * Falls back to a random floor tile if no nearby candidate is found quickly.
       */
      findSpawnPointNear(player, minR = 240, maxR = 760) {
        const minSq = minR * minR;
        const maxSq = maxR * maxR;

        for (let i = 0; i < 120; i++) {
          const pick = floorTiles[Math.floor(rng() * floorTiles.length)];
          if (!pick) break;
          const p = toWorld(pick.tx, pick.ty);
          const dx = p.x - player.x;
          const dy = p.y - player.y;
          const dSq = dx * dx + dy * dy;
          if (dSq >= minSq && dSq <= maxSq) return p;
        }

        const fallback = floorTiles[Math.floor(rng() * floorTiles.length)] ?? startTile;
        return toWorld(fallback.tx, fallback.ty);
      },
    };

    return map;
  }
}
