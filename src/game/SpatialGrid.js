/**
 * SpatialGrid
 * Divides infinite 2D world space into fixed-size cells. Entities are inserted
 * into all cells their bounding circle overlaps. Querying returns all candidates
 * from the cells a query entity overlaps — eliminating the need to test every
 * entity pair (bringing collision from O(N²) toward O(N) in practice).
 *
 * Usage pattern (once per frame):
 *   grid.clear();
 *   for (const e of entities) grid.insert(e);
 *   for (const query of queries) {
 *     results.length = 0;
 *     grid.query(query, results); // fills results with nearby candidates
 *   }
 */
export class SpatialGrid {
  /**
   * @param {number} cellSize - world-unit width/height of each cell.
   *   Should be at least 2× the largest entity radius so an entity never spans
   *   more than 4 cells (keeping the overhead constant per entity).
   */
  constructor(cellSize = 128) {
    this.cellSize = cellSize;
    // Map<string, Entity[]>  —  key is `"${cx},${cy}"`
    this._cells = new Map();
    // Tracks keys that have at least one entity so clear() can zero them in O(populated).
    this._activeCells = [];
  }

  /** Remove all entities from all cells. O(populated cells, not world size). */
  clear() {
    for (const key of this._activeCells) {
      // Reuse the array object — just reset length — to avoid GC pressure.
      this._cells.get(key).length = 0;
    }
    this._activeCells.length = 0;
  }

  /**
   * Insert entity into every cell its bounding circle overlaps.
   * At most 4 cells for a cell size ≥ 2× entity radius.
   */
  insert(entity) {
    const { cellSize, _cells, _activeCells } = this;
    const r = entity.radius;
    const minCx = Math.floor((entity.x - r) / cellSize);
    const maxCx = Math.floor((entity.x + r) / cellSize);
    const minCy = Math.floor((entity.y - r) / cellSize);
    const maxCy = Math.floor((entity.y + r) / cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = `${cx},${cy}`;
        let cell = _cells.get(key);
        if (!cell) {
          cell = [];
          _cells.set(key, cell);
        }
        if (cell.length === 0) _activeCells.push(key);
        cell.push(entity);
      }
    }
  }

  /**
   * Fill `results` with all unique entities whose cells overlap the query entity.
   * Uses a Set to deduplicate entities that span multiple cells.
   * @param {object} entity - object with {x, y, radius}
   * @param {object[]} results - array to push candidates into (caller must pre-clear)
   * @returns {object[]} the results array
   */
  query(entity, results) {
    const { cellSize, _cells } = this;
    const r = entity.radius;
    const minCx = Math.floor((entity.x - r) / cellSize);
    const maxCx = Math.floor((entity.x + r) / cellSize);
    const minCy = Math.floor((entity.y - r) / cellSize);
    const maxCy = Math.floor((entity.y + r) / cellSize);

    // Fast path: entity is in a single cell (most common case at cellSize=128)
    if (minCx === maxCx && minCy === maxCy) {
      const cell = _cells.get(`${minCx},${minCy}`);
      if (cell) {
        for (const e of cell) results.push(e);
      }
      return results;
    }

    // Multi-cell path: deduplicate with a Set
    const seen = new Set();
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = _cells.get(`${cx},${cy}`);
        if (!cell) continue;
        for (const e of cell) {
          if (!seen.has(e)) {
            seen.add(e);
            results.push(e);
          }
        }
      }
    }
    return results;
  }

  /**
   * Returns the number of currently occupied cells.
   * Used by the debug overlay.
   */
  get activeCellCount() {
    return this._activeCells.length;
  }

  /**
   * Returns world-space rectangles for all occupied cells (used for debug rendering).
   * @returns {{ wx: number, wy: number }[]}
   */
  getActiveCellRects() {
    const { cellSize } = this;
    return this._activeCells.map((key) => {
      const comma = key.indexOf(',');
      const cx = parseInt(key, 10);
      const cy = parseInt(key.slice(comma + 1), 10);
      return { wx: cx * cellSize, wy: cy * cellSize };
    });
  }
}
