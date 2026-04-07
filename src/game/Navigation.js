function keyOf(tx, ty, cols) {
  return ty * cols + tx;
}

function heuristic(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function nearestWalkableTile(tx, ty, mapLayout, maxRadius = 4) {
  if (!mapLayout.isWall(tx, ty)) return { tx, ty };

  for (let r = 1; r <= maxRadius; r++) {
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        const nx = tx + ox;
        const ny = ty + oy;
        if (mapLayout.isWall(nx, ny)) continue;
        return { tx: nx, ty: ny };
      }
    }
  }

  return null;
}

function reconstructPath(cameFrom, currentKey, cols) {
  const out = [];
  let cursor = currentKey;
  while (cursor != null) {
    const tx = cursor % cols;
    const ty = Math.floor(cursor / cols);
    out.push({ tx, ty });
    cursor = cameFrom.get(cursor) ?? null;
  }
  out.reverse();
  return out;
}

export class Navigation {
  /**
   * Build and cache a compact walkability map for A* queries.
   */
  static buildCache(mapLayout) {
    if (!mapLayout) return null;
    const { cols, rows } = mapLayout;
    const walkable = new Uint8Array(cols * rows);

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        walkable[keyOf(tx, ty, cols)] = mapLayout.isWall(tx, ty) ? 0 : 1;
      }
    }

    return {
      cols,
      rows,
      walkable,
      mapSeed: mapLayout.seed,
      mapId: mapLayout.mapId,
      tileSize: mapLayout.tileSize,
      worldLeft: mapLayout.worldLeft,
      worldTop: mapLayout.worldTop,
    };
  }

  /**
   * A* path over map tiles. Returns world-space waypoints.
   */
  static findPath(startX, startY, targetX, targetY, mapLayout, cache = null) {
    if (!mapLayout) return null;
    const nav = cache ?? Navigation.buildCache(mapLayout);
    if (!nav) return null;

    const startTile = mapLayout.worldToTile(startX, startY);
    const goalTile = mapLayout.worldToTile(targetX, targetY);

    const s = nearestWalkableTile(startTile.tx, startTile.ty, mapLayout);
    const g = nearestWalkableTile(goalTile.tx, goalTile.ty, mapLayout);
    if (!s || !g) return null;

    const startKey = keyOf(s.tx, s.ty, nav.cols);
    const goalKey = keyOf(g.tx, g.ty, nav.cols);
    if (startKey === goalKey) {
      return [{ x: targetX, y: targetY }];
    }

    const open = [startKey];
    const openSet = new Set([startKey]);
    const cameFrom = new Map();
    const gScore = new Map([[startKey, 0]]);
    const fScore = new Map([[startKey, heuristic(s.tx, s.ty, g.tx, g.ty)]]);

    const maxNodes = 4500;
    let explored = 0;

    while (open.length > 0 && explored < maxNodes) {
      explored++;

      let bestIdx = 0;
      let bestKey = open[0];
      let bestF = fScore.get(bestKey) ?? Number.POSITIVE_INFINITY;
      for (let i = 1; i < open.length; i++) {
        const k = open[i];
        const f = fScore.get(k) ?? Number.POSITIVE_INFINITY;
        if (f < bestF) {
          bestF = f;
          bestIdx = i;
          bestKey = k;
        }
      }

      const currentKey = bestKey;
      open.splice(bestIdx, 1);
      openSet.delete(currentKey);

      if (currentKey === goalKey) {
        const tilePath = reconstructPath(cameFrom, currentKey, nav.cols);
        const worldPath = tilePath.map(({ tx, ty }) => mapLayout.tileToWorld(tx, ty));
        // Keep the final waypoint tight to current player position.
        worldPath[worldPath.length - 1] = { x: targetX, y: targetY };
        return worldPath;
      }

      const cx = currentKey % nav.cols;
      const cy = Math.floor(currentKey / nav.cols);
      const neighbors = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];

      const currentG = gScore.get(currentKey) ?? Number.POSITIVE_INFINITY;

      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= nav.cols || ny >= nav.rows) continue;
        const nKey = keyOf(nx, ny, nav.cols);
        if (!nav.walkable[nKey]) continue;

        const tentativeG = currentG + 1;
        const knownG = gScore.get(nKey) ?? Number.POSITIVE_INFINITY;
        if (tentativeG >= knownG) continue;

        cameFrom.set(nKey, currentKey);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + heuristic(nx, ny, g.tx, g.ty));

        if (!openSet.has(nKey)) {
          open.push(nKey);
          openSet.add(nKey);
        }
      }
    }

    return null;
  }
}
