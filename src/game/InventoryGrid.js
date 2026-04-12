/**
 * InventoryGrid
 * A 2-D grid of fixed dimensions (cols × rows) that holds item definitions.
 * Items occupy a rectangular block of cells determined by their gridW / gridH fields.
 *
 * All public mutating methods are O(gridW × gridH) — items are rare, so this is fine.
 */

const RARITY_COLORS = {
  normal: '#9e9e9e',
  magic:  '#6b9cd4',
  rare:   '#f1c40f',
  unique: '#c86400',
};

export class InventoryGrid {
  /**
   * @param {number} [cols=10]
   * @param {number} [rows=5]
   */
  constructor(cols = 10, rows = 5) {
    this.cols = cols;
    this.rows = rows;
    /** @type {(string|null)[][]} null = empty cell; string = uid of the item occupying it */
    this._grid = Array.from({ length: rows }, () => new Array(cols).fill(null));
    /** @type {Map<string, { itemDef: object, gridX: number, gridY: number }>} */
    this._items = new Map();
  }

  // ─── Placement helpers ──────────────────────────────────────────────────

  /**
   * Returns true if `itemDef` can be placed with its top-left corner at (col, row).
   * Does NOT count the item's own cells as occupied (supports future in-place move).
   */
  canPlace(itemDef, col, row) {
    const { gridW, gridH, uid } = itemDef;
    for (let r = row; r < row + gridH; r++) {
      for (let c = col; c < col + gridW; c++) {
        if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return false;
        const cell = this._grid[r][c];
        if (cell !== null && cell !== uid) return false;
      }
    }
    return true;
  }

  /**
   * Place item with top-left at (col, row).
   * @returns {boolean} success
   */
  place(itemDef, col, row) {
    if (!this.canPlace(itemDef, col, row)) return false;
    const { uid, gridW, gridH } = itemDef;
    for (let r = row; r < row + gridH; r++) {
      for (let c = col; c < col + gridW; c++) {
        this._grid[r][c] = uid;
      }
    }
    this._items.set(uid, { itemDef, gridX: col, gridY: row });
    return true;
  }

  /**
   * Remove item by uid.
   * @returns {object|null} the removed itemDef, or null if not found
   */
  remove(uid) {
    const entry = this._items.get(uid);
    if (!entry) return null;
    const { itemDef, gridX, gridY } = entry;
    for (let r = gridY; r < gridY + itemDef.gridH; r++) {
      for (let c = gridX; c < gridX + itemDef.gridW; c++) {
        if (this._grid[r][c] === uid) this._grid[r][c] = null;
      }
    }
    this._items.delete(uid);
    return itemDef;
  }

  // ─── Auto-placement ─────────────────────────────────────────────────────

  /**
   * Scan top-left → bottom-right for the first position where itemDef fits.
   * @returns {{ col: number, row: number } | null}
   */
  findFirstFit(itemDef) {
    for (let r = 0; r <= this.rows - itemDef.gridH; r++) {
      for (let c = 0; c <= this.cols - itemDef.gridW; c++) {
        if (this.canPlace(itemDef, c, r)) return { col: c, row: r };
      }
    }
    return null;
  }

  /**
   * Auto-place at first available position.
   * @returns {boolean} success (false = inventory full)
   */
  autoPlace(itemDef) {
    const pos = this.findFirstFit(itemDef);
    if (!pos) return false;
    return this.place(itemDef, pos.col, pos.row);
  }

  // ─── Lookup ─────────────────────────────────────────────────────────────

  /** itemDef for the item whose cells include (col, row), or null. */
  getItemDefAt(col, row) {
    const uid = this._grid[row]?.[col];
    return uid ? (this._items.get(uid)?.itemDef ?? null) : null;
  }

  /** itemDef by uid. */
  getItemDef(uid) {
    return this._items.get(uid)?.itemDef ?? null;
  }

  /** True if the grid has no items. */
  get isEmpty() {
    return this._items.size === 0;
  }

  /**
   * Serialise the grid for React rendering.
   * Returns a compact snapshot of all placed items — no grid cell array included.
   */
  serialize() {
    return {
      cols: this.cols,
      rows: this.rows,
      items: Array.from(this._items.values()).map(({ itemDef, gridX, gridY }) => ({
        uid:         itemDef.uid,
        id:          itemDef.id,
        type:        itemDef.type,
        name:        itemDef.name,
        rarity:      itemDef.rarity ?? 'normal',
        color:       RARITY_COLORS[itemDef.rarity ?? 'normal'],
        gridW:       itemDef.gridW,
        gridH:       itemDef.gridH,
        gridX,
        gridY,
        slot:        itemDef.slot,
        description: itemDef.description,
        affixes:     itemDef.affixes ?? [],
        isUnique:    itemDef.isUnique ?? false,
        flavorText:  itemDef.flavorText ?? null,
        baseStats:   itemDef.baseStats ?? itemDef.stats ?? {},
        defenseType: itemDef.defenseType ?? null,
        gemId:       itemDef.gemId ?? null,
        gemIcon:     itemDef.gemIcon ?? null,
        skillOfferId: itemDef.skillOfferId ?? null,
        mapTheme:    itemDef.mapTheme ?? null,
        mapMods:     itemDef.mapMods ?? [],
        mapItemLevel: itemDef.mapItemLevel ?? null,
      })),
    };
  }

  /** Wipe all items — used on game restart. */
  clear() {
    for (let r = 0; r < this.rows; r++) this._grid[r].fill(null);
    this._items.clear();
  }
}
