/**
 * HubWorld (C3)
 * A bounded, non-combat zone with interactable points of interest.
 */
export class HubWorld {
  constructor() {
    this.width = 2400;
    this.height = 1600;

    /**
     * Interactable points in world space.
     * key: keyboard shortcut shown in the UI prompt.
     */
    this.interactables = [
      { id: 'stash',        x: -760, y: -260, radius: 70, label: 'League Stash',    key: 'F', color: '#5db6ff' },
      { id: 'passive_tree', x: -780, y:  380, radius: 70, label: 'Passive Tree',    key: 'P', color: '#f1c40f' },
      { id: 'map_device',   x:    0, y: -300, radius: 78, label: 'Map Device',      key: 'M', color: '#8e7dff' },
      { id: 'vendor',       x:  760, y: -260, radius: 70, label: 'Vendor',          key: 'V', color: '#9ad26a' },
      { id: 'crafting',     x:  740, y:  380, radius: 70, label: 'Crafting Bench',  key: 'C', color: '#ff9f5c' },
    ];

    this._time = 0;
    this._nearby = null;
    this.mapPortal = null;
  }

  /** Add a temporary enterable map portal near the map device. */
  setMapPortal(mapDef) {
    if (!mapDef) {
      this.mapPortal = null;
      return;
    }
    this.mapPortal = {
      id: 'map_portal',
      x: 0,
      y: -150,
      radius: 62,
      label: `Portal: ${mapDef.name}`,
      key: 'F',
      color: '#2ad4ff',
    };
  }

  clearMapPortal() {
    this.mapPortal = null;
  }

  _allInteractables() {
    return this.mapPortal ? [...this.interactables, this.mapPortal] : this.interactables;
  }

  /**
   * Update hub simulation and return nearest interactable in range.
   * @param {number} dt
   * @param {import('./entities/Player.js').Player} player
   * @returns {object|null}
   */
  update(dt, player) {
    this._time += dt;

    // Keep the player inside the hub rectangle.
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const r = player.radius ?? 16;
    player.x = Math.max(-halfW + r, Math.min(halfW - r, player.x));
    player.y = Math.max(-halfH + r, Math.min(halfH - r, player.y));

    this._nearby = this.getNearbyInteractable(player);
    return this._nearby;
  }

  /**
   * Get the nearest interactable within activation range.
   * @param {import('./entities/Player.js').Player} player
   * @returns {object|null}
   */
  getNearbyInteractable(player) {
    let best = null;
    let bestSq = Infinity;
    for (const spot of this._allInteractables()) {
      const dx = player.x - spot.x;
      const dy = player.y - spot.y;
      const dSq = dx * dx + dy * dy;
      if (dSq <= spot.radius * spot.radius && dSq < bestSq) {
        bestSq = dSq;
        best = spot;
      }
    }
    return best;
  }

  /**
   * Draw the hub floor, border, and interactable markers.
   * @param {import('./Renderer.js').Renderer} renderer
   */
  draw(renderer) {
    const { ctx, camX, camY, width, height } = renderer;

    // Dark stone base.
    ctx.fillStyle = '#0f1217';
    ctx.fillRect(0, 0, width, height);

    // Stone tile pattern inside the hub bounds.
    const tile = 64;
    const left = -this.width / 2;
    const top = -this.height / 2;
    const right = this.width / 2;
    const bottom = this.height / 2;

    const startX = Math.floor((camX + left) / tile) * tile;
    const startY = Math.floor((camY + top) / tile) * tile;

    for (let wx = startX; wx < camX + width + tile; wx += tile) {
      for (let wy = startY; wy < camY + height + tile; wy += tile) {
        if (wx < left || wx > right || wy < top || wy > bottom) continue;
        const sx = wx - camX;
        const sy = wy - camY;
        ctx.fillStyle = ((Math.floor(wx / tile) + Math.floor(wy / tile)) % 2 === 0)
          ? '#1b2128'
          : '#171d24';
        ctx.fillRect(sx, sy, tile, tile);
      }
    }

    // Hub border walls.
    const border = renderer.toScreen(left, top);
    ctx.strokeStyle = '#44515f';
    ctx.lineWidth = 6;
    ctx.strokeRect(border.x, border.y, this.width, this.height);

    // Interactable rings + labels.
    const pulse = 0.5 + 0.5 * Math.sin(this._time * 2.3);
    for (const spot of this._allInteractables()) {
      const active = this._nearby?.id === spot.id;
      const glowAlpha = active ? (0.25 + pulse * 0.35) : 0.14;
      const ringAlpha = active ? 0.95 : 0.55;

      renderer.drawCircle(spot.x, spot.y, spot.radius + (active ? 8 + pulse * 5 : 4), spot.color, glowAlpha);
      renderer.drawStrokeCircle(spot.x, spot.y, spot.radius, spot.color, active ? 3 : 2, ringAlpha);
      renderer.drawCircle(spot.x, spot.y, 10, '#f2f5f8', 0.9);

      renderer.drawText(spot.x, spot.y - spot.radius - 16, spot.label, '#d7dde6', 12, 'center');
      renderer.drawText(
        spot.x,
        spot.y - spot.radius - 2,
        spot.id === 'map_portal' ? 'Click to Enter' : 'Click to Open',
        spot.color,
        11,
        'center',
      );
    }
  }
}
