import { TILE_SIZE } from './config.js';

/**
 * Renderer
 * Wraps Canvas 2D context with world-space draw helpers and camera transform.
 * All draw* methods accept world coordinates; the camera offset is applied internally.
 */
export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.camX = 0; // top-left world x visible on screen
    this.camY = 0; // top-left world y visible on screen
    this.width = 0;
    this.height = 0;
  }

  /**
   * Update camera so the view is centred on (worldX, worldY).
   * Call once per frame before drawing anything.
   */
  setCamera(worldX, worldY, width, height) {
    this.camX = worldX - width / 2;
    this.camY = worldY - height / 2;
    this.width = width;
    this.height = height;
  }

  clear(width, height) {
    this.ctx.clearRect(0, 0, width, height);
  }

  /** Draw a scrolling dark grid as the background. Accepts an optional theme. */
  drawBackground(theme = null) {
    const { ctx, camX, camY, width, height } = this;
    const bg   = theme?.bg   ?? '#1a1a2e';
    const grid = theme?.grid ?? '#16213e';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;

    const startX = Math.floor(camX / TILE_SIZE) * TILE_SIZE;
    const startY = Math.floor(camY / TILE_SIZE) * TILE_SIZE;

    for (let wx = startX; wx < camX + width + TILE_SIZE; wx += TILE_SIZE) {
      for (let wy = startY; wy < camY + height + TILE_SIZE; wy += TILE_SIZE) {
        ctx.strokeRect(wx - camX, wy - camY, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  /** Draw generated map floor/walls from MapGenerator output. */
  drawGeneratedMap(mapLayout, theme = null) {
    if (!mapLayout) {
      this.drawBackground(theme);
      return;
    }

    const { ctx, camX, camY, width, height } = this;
    const floorA = theme?.grid ?? '#16213e';
    const floorB = theme?.bg ?? '#1a1a2e';
    const wallA = '#2f3a46';
    const wallB = '#3b4957';
    const wallEdge = '#556678';

    ctx.fillStyle = '#0c1118';
    ctx.fillRect(0, 0, width, height);

    const tile = mapLayout.tileSize;
    const startTx = Math.max(0, Math.floor((camX - mapLayout.worldLeft) / tile) - 1);
    const endTx = Math.min(mapLayout.cols - 1, Math.ceil((camX + width - mapLayout.worldLeft) / tile) + 1);
    const startTy = Math.max(0, Math.floor((camY - mapLayout.worldTop) / tile) - 1);
    const endTy = Math.min(mapLayout.rows - 1, Math.ceil((camY + height - mapLayout.worldTop) / tile) + 1);

    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const wx = mapLayout.worldLeft + tx * tile;
        const wy = mapLayout.worldTop + ty * tile;
        const sx = wx - camX;
        const sy = wy - camY;
        const isWall = mapLayout.tiles[ty][tx] === 1;

        if (isWall) {
          ctx.fillStyle = (tx + ty) % 2 === 0 ? wallA : wallB;
          ctx.fillRect(sx, sy, tile, tile);
          ctx.strokeStyle = wallEdge;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 0.5, sy + 0.5, tile - 1, tile - 1);
        } else {
          ctx.fillStyle = (tx + ty) % 2 === 0 ? floorA : floorB;
          ctx.fillRect(sx, sy, tile, tile);
        }
      }
    }
  }

  /**
   * Draw the active boss's health bar as a screen-space overlay at the top centre.
   * @param {import('./entities/BossEnemy.js').BossEnemy} boss
   */
  drawBossHealthBar(boss) {
    const { ctx, width } = this;
    const barW  = Math.min(width * 0.45, 480);
    const barH  = 13;
    const barX  = (width - barW) / 2;
    const barY  = 18;
    const ratio = Math.max(0, boss.health / boss.maxHealth);

    // Background box
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(barX - 6, barY - 18, barW + 12, barH + 28);

    // Boss name
    ctx.fillStyle = 'rgba(210,200,230,0.88)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(boss.bossName.toUpperCase(), width / 2, barY - 4);

    // Bar background
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(barX, barY, barW, barH);

    // Bar fill
    ctx.fillStyle = boss.color;
    ctx.fillRect(barX, barY, Math.round(barW * ratio), barH);

    // HP numbers
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '9px monospace';
    ctx.fillText(
      `${Math.ceil(boss.health)} / ${boss.maxHealth}`,
      width / 2,
      barY + barH + 11,
    );
  }

  /** Convert world coordinates to screen coordinates. */
  toScreen(worldX, worldY) {
    return { x: worldX - this.camX, y: worldY - this.camY };
  }

  drawCircle(worldX, worldY, radius, color, alpha = 1) {
    const { x, y } = this.toScreen(worldX, worldY);
    const { ctx } = this;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /**
   * Draw a health/XP bar above an entity.
   * @param {number} offsetY - vertical offset in screen px above the entity centre
   */
  drawHealthBar(worldX, worldY, current, max, barWidth = 30, offsetY = -20) {
    const { x, y } = this.toScreen(worldX, worldY);
    const { ctx } = this;
    const barH = 4;
    const barX = x - barWidth / 2;
    const barY = y + offsetY;
    const ratio = current / max;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barH);

    const fillColor = ratio > 0.5 ? '#4ecdc4' : ratio > 0.25 ? '#ffe66d' : '#ff6b6b';
    ctx.fillStyle = fillColor;
    ctx.fillRect(barX, barY, barWidth * ratio, barH);
  }

  drawText(worldX, worldY, text, color = '#fff', fontSize = 14, align = 'center') {
    const { x, y } = this.toScreen(worldX, worldY);
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  /**
   * Draw a stroked (outlined) circle in world space.
   * Used for champion rings, Voltaic Arc expanding rings, and Righteous Pyre pulses.
   */
  drawStrokeCircle(worldX, worldY, radius, color, lineWidth = 2, alpha = 1) {
    if (radius <= 0 || alpha <= 0) return;
    const { x, y } = this.toScreen(worldX, worldY);
    const { ctx } = this;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawTargetLock(worldX, worldY, radius, isBoss = false) {
    const { x, y } = this.toScreen(worldX, worldY);
    const { ctx } = this;
    const color = isBoss ? '#ffd166' : '#8bd3ff';
    const ringR = Math.max(16, radius);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = isBoss ? 3 : 2;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(x, y, ringR, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i;
      const ix = x + Math.cos(angle) * ringR;
      const iy = y + Math.sin(angle) * ringR;
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(x + Math.cos(angle) * (ringR + 8), y + Math.sin(angle) * (ringR + 8));
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Draw a line segment between two world-space points.
   * Used by ChainLightning arc flashes and BoneSpear crack decals.
   */
  drawLine(worldX1, worldY1, worldX2, worldY2, color, lineWidth = 2, alpha = 1) {
    if (alpha <= 0) return;
    const p1 = this.toScreen(worldX1, worldY1);
    const p2 = this.toScreen(worldX2, worldY2);
    const { ctx } = this;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /**
   * Draw developer debug overlay in the top-right corner.
   * Enabled by pressing F3 in-game.
   * @param {{ fps, enemies, projectiles, gems, gridCellCount, cellSize }} info
   */
  drawDebugOverlay(info) {
    const { ctx, width } = this;
    const { fps, enemies, projectiles, gems, gridCellCount, cellSize } = info;

    // Draw spatial grid cell outlines so you can see the partitioning live.
    // We shade every ceil-sized square that the camera currently covers.
    const startCx = Math.floor(this.camX / cellSize);
    const endCx   = Math.ceil((this.camX + width) / cellSize);
    const startCy = Math.floor(this.camY / cellSize);
    const endCy   = Math.ceil((this.camY + this.height) / cellSize);

    ctx.strokeStyle = 'rgba(255, 220, 0, 0.10)';
    ctx.lineWidth = 1;
    for (let cx = startCx; cx <= endCx; cx++) {
      for (let cy = startCy; cy <= endCy; cy++) {
        ctx.strokeRect(
          cx * cellSize - this.camX,
          cy * cellSize - this.camY,
          cellSize,
          cellSize,
        );
      }
    }

    // Stats box — top-right corner
    const lines = [
      `F3: debug ON`,
      `FPS : ${fps}`,
      `Enemies     : ${enemies}`,
      `Projectiles : ${projectiles}`,
      `Gems        : ${gems}`,
      `Particles   : ${info.particles ?? 0}`,
      `Grid cells  : ${gridCellCount}`,
    ];
    const lineH = 17;
    const pad   = 8;
    const boxW  = 178;
    const boxH  = lines.length * lineH + pad * 2;
    const boxX  = width - boxW - 8;
    const boxY  = 8;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    lines.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? '#f1c40f' : '#00ff88';
      ctx.fillText(line, boxX + pad, boxY + pad + 12 + i * lineH);
    });
  }
}
