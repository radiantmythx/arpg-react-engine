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
    this.performance = {
      drawBackgroundGrid: true,
      backgroundGridStep: 1,
      drawWallDetails: true,
    };
  }

  setPerformanceOptions(options = {}) {
    this.performance = { ...this.performance, ...options };
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

    if (!this.performance.drawBackgroundGrid) return;

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;

    const step = TILE_SIZE * Math.max(1, this.performance.backgroundGridStep ?? 1);
    const startX = Math.floor(camX / step) * step;
    const startY = Math.floor(camY / step) * step;

    for (let wx = startX; wx < camX + width + step; wx += step) {
      for (let wy = startY; wy < camY + height + step; wy += step) {
        ctx.strokeRect(wx - camX, wy - camY, step, step);
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
          if (this.performance.drawWallDetails !== false) {
            ctx.strokeStyle = wallEdge;
            ctx.lineWidth = 1;
            ctx.strokeRect(sx + 0.5, sy + 0.5, tile - 1, tile - 1);
          }
        } else {
          ctx.fillStyle = (tx + ty) % 2 === 0 ? floorA : floorB;
          ctx.fillRect(sx, sy, tile, tile);
        }
      }
    }

    this._drawMapTerrain(mapLayout, camX, camY, startTx, endTx, startTy, endTy);
    this._drawMapModOverlays(mapLayout, camX, camY, startTx, endTx, startTy, endTy);
    this._drawMapRoomOverlays(mapLayout, camX, camY);
    this._drawMapSetpieceOverlays(mapLayout, camX, camY);
    this._drawMapObstacles(mapLayout, camX, camY);
  }

  _drawMapModOverlays(mapLayout, camX, camY, startTx, endTx, startTy, endTy) {
    const { ctx } = this;
    const overlaySet = new Set(mapLayout?.mapModMetadata?.postGeneration?.visualOverlays ?? []);
    if (overlaySet.size === 0) return;
    const tile = mapLayout.tileSize;

    if (overlaySet.has('flooded_tint') || overlaySet.has('overgrown_tint')) {
      const flood = overlaySet.has('flooded_tint');
      const over = overlaySet.has('overgrown_tint');
      const color = flood && over
        ? 'rgba(102, 164, 146, 0.08)'
        : flood
          ? 'rgba(88, 156, 186, 0.1)'
          : 'rgba(96, 142, 86, 0.1)';
      ctx.fillStyle = color;
      for (let ty = startTy; ty <= endTy; ty++) {
        for (let tx = startTx; tx <= endTx; tx++) {
          if (mapLayout.tiles[ty][tx] !== 0) continue;
          const sx = mapLayout.worldLeft + tx * tile - camX;
          const sy = mapLayout.worldTop + ty * tile - camY;
          ctx.fillRect(sx, sy, tile, tile);
        }
      }
    }

    if (overlaySet.has('fortified_lines')) {
      ctx.strokeStyle = 'rgba(182, 173, 139, 0.22)';
      ctx.lineWidth = 1;
      for (let ty = startTy; ty <= endTy; ty += 3) {
        const sy = mapLayout.worldTop + ty * tile - camY + tile * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(this.width, sy);
        ctx.stroke();
      }
    }

    if (overlaySet.has('corrupted_veil')) {
      ctx.fillStyle = 'rgba(126, 57, 62, 0.09)';
      for (let ty = startTy; ty <= endTy; ty++) {
        for (let tx = startTx; tx <= endTx; tx++) {
          if (mapLayout.tiles[ty][tx] !== 0) continue;
          const sx = mapLayout.worldLeft + tx * tile - camX;
          const sy = mapLayout.worldTop + ty * tile - camY;
          ctx.fillRect(sx, sy, tile, tile);
        }
      }

      const finalThirdIds = mapLayout.encounterMetadata?.bossApproach?.finalThirdRoomIds ?? [];
      ctx.strokeStyle = 'rgba(186, 92, 78, 0.32)';
      ctx.lineWidth = 1;
      for (const roomId of finalThirdIds) {
        const room = mapLayout.rooms?.find((candidate) => candidate.id === roomId);
        if (!room) continue;
        const cx = mapLayout.worldLeft + room.centerX * tile + tile * 0.5 - camX;
        const cy = mapLayout.worldTop + room.centerY * tile + tile * 0.5 - camY;
        const r = Math.max(tile * 0.65, Math.min(room.w, room.h) * tile * 0.18);
        ctx.beginPath();
        ctx.moveTo(cx - r, cy - r * 0.2);
        ctx.lineTo(cx + r, cy + r * 0.2);
        ctx.moveTo(cx - r * 0.25, cy - r);
        ctx.lineTo(cx + r * 0.2, cy + r);
        ctx.stroke();
      }
    }

    if (overlaySet.has('volatile_glyphs')) {
      ctx.fillStyle = 'rgba(255, 124, 124, 0.22)';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const node of mapLayout.encounterMetadata?.setpieceNodes ?? []) {
        if (!node.tags?.includes('volatile')) continue;
        const p = this.toScreen(
          mapLayout.worldLeft + node.centerTile.tx * tile + tile * 0.5,
          mapLayout.worldTop + node.centerTile.ty * tile + tile * 0.5,
        );
        ctx.fillText('*', p.x, p.y - tile * 0.35);
      }
    }
  }

  _drawMapTerrain(mapLayout, camX, camY, startTx, endTx, startTy, endTy) {
    const { ctx } = this;
    const tile = mapLayout.tileSize;
    const mask = mapLayout.terrainMask;
    if (!mask) return;

    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        if (mapLayout.tiles[ty][tx] !== 0) continue;
        const code = mask[ty * mapLayout.cols + tx] ?? 0;
        if (!code) continue;

        const wx = mapLayout.worldLeft + tx * tile;
        const wy = mapLayout.worldTop + ty * tile;
        const sx = wx - camX;
        const sy = wy - camY;

        if (code === 1) {
          ctx.fillStyle = 'rgba(110, 92, 62, 0.34)'; // mud
          ctx.fillRect(sx, sy, tile, tile);
        } else if (code === 2) {
          ctx.fillStyle = 'rgba(78, 149, 176, 0.34)'; // shallow water
          ctx.fillRect(sx, sy, tile, tile);
          ctx.strokeStyle = 'rgba(168, 228, 255, 0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx + 2, sy + tile * 0.38);
          ctx.lineTo(sx + tile - 2, sy + tile * 0.38);
          ctx.stroke();
        } else if (code === 3) {
          ctx.fillStyle = 'rgba(127, 117, 105, 0.28)'; // ash
          ctx.fillRect(sx, sy, tile, tile);
          ctx.fillStyle = 'rgba(196, 184, 169, 0.2)';
          ctx.fillRect(sx + tile * 0.2, sy + tile * 0.2, tile * 0.18, tile * 0.18);
        } else if (code === 4) {
          ctx.fillStyle = 'rgba(73, 108, 70, 0.3)'; // brambles
          ctx.fillRect(sx, sy, tile, tile);
          ctx.strokeStyle = 'rgba(132, 187, 118, 0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx + tile * 0.2, sy + tile * 0.82);
          ctx.lineTo(sx + tile * 0.76, sy + tile * 0.22);
          ctx.moveTo(sx + tile * 0.34, sy + tile * 0.86);
          ctx.lineTo(sx + tile * 0.82, sy + tile * 0.44);
          ctx.stroke();
        } else if (code === 5) {
          ctx.fillStyle = 'rgba(167, 206, 230, 0.26)'; // cracked ice
          ctx.fillRect(sx, sy, tile, tile);
          ctx.strokeStyle = 'rgba(219, 245, 255, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx + tile * 0.15, sy + tile * 0.2);
          ctx.lineTo(sx + tile * 0.52, sy + tile * 0.53);
          ctx.lineTo(sx + tile * 0.85, sy + tile * 0.34);
          ctx.stroke();
        }
      }
    }
  }

  _drawMapRoomOverlays(mapLayout, camX, camY) {
    const { ctx, width, height } = this;
    const tile = mapLayout.tileSize;
    const roomTypeColor = {
      start: 'rgba(88, 194, 156, 0.08)',
      boss: 'rgba(196, 92, 92, 0.08)',
      elite: 'rgba(158, 110, 211, 0.07)',
      treasure: 'rgba(220, 182, 85, 0.08)',
      combat: 'rgba(120, 164, 220, 0.04)',
    };

    for (const room of mapLayout.rooms ?? []) {
      const wx = mapLayout.worldLeft + room.x * tile;
      const wy = mapLayout.worldTop + room.y * tile;
      const ww = room.w * tile;
      const wh = room.h * tile;
      const sx = wx - camX;
      const sy = wy - camY;

      if (sx > width || sy > height || sx + ww < 0 || sy + wh < 0) continue;

      const shapeColor = mapLayout.roomShapePalette?.[room.roomShape] ?? '#26405a';
      ctx.fillStyle = roomTypeColor[room.type] ?? 'rgba(120, 164, 220, 0.04)';
      ctx.fillRect(sx, sy, ww, wh);

      ctx.strokeStyle = `${shapeColor}aa`;
      ctx.lineWidth = room.type === 'boss' ? 2 : 1;
      ctx.strokeRect(sx + 1, sy + 1, Math.max(0, ww - 2), Math.max(0, wh - 2));

      if (room.type === 'boss' && room.bossArenaStyle) {
        const center = mapLayout.tileToWorld(room.centerX, room.centerY);
        const p = this.toScreen(center.x, center.y);
        const radius = Math.max(tile * 1.4, Math.min(ww, wh) * 0.24);
        ctx.save();
        ctx.strokeStyle = mapLayout.bossArenaPalette?.[room.bossArenaStyle] ?? '#8b5f5f';
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 2;

        if (room.bossArenaStyle === 'duel_circle') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        } else if (room.bossArenaStyle === 'pillar_hall') {
          ctx.strokeRect(p.x - radius, p.y - radius * 0.8, radius * 2, radius * 1.6);
        } else if (room.bossArenaStyle === 'throne_dais') {
          ctx.strokeRect(p.x - radius * 0.85, sy + tile * 0.7, radius * 1.7, tile * 1.25);
        } else if (room.bossArenaStyle === 'broken_arena') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, Math.PI * 0.12, Math.PI * 1.72);
          ctx.stroke();
        } else if (room.bossArenaStyle === 'chapel_cross') {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - radius);
          ctx.lineTo(p.x, p.y + radius);
          ctx.moveTo(p.x - radius * 0.65, p.y);
          ctx.lineTo(p.x + radius * 0.65, p.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (room.type === 'boss' && room.corruptionVariant) {
        const center = mapLayout.tileToWorld(room.centerX, room.centerY);
        const p = this.toScreen(center.x, center.y);
        const radius = Math.max(tile * 1.1, Math.min(ww, wh) * 0.2);
        ctx.save();
        ctx.strokeStyle = 'rgba(199, 88, 92, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 170, 170, 0.75)';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const glyph = room.corruptionVariant === 'void_fracture'
          ? 'V'
          : room.corruptionVariant === 'blood_ritual'
            ? 'B'
            : 'S';
        ctx.fillText(glyph, p.x, p.y - radius - 8);
        ctx.restore();
      }
    }
  }

  _drawMapObstacles(mapLayout, camX, camY) {
    const { ctx, width, height } = this;
    const tile = mapLayout.tileSize;

    for (const obstacle of mapLayout.obstacles ?? []) {
      const world = mapLayout.tileToWorld(obstacle.centerX, obstacle.centerY);
      const p = this.toScreen(world.x, world.y);
      const radius = tile * (obstacle.radiusTiles ?? 0.4);
      if (p.x + tile < 0 || p.y + tile < 0 || p.x - tile > width || p.y - tile > height) continue;
      const decorative = obstacle.collision === false || obstacle.category === 'decorative_non_collision';

      ctx.save();
      ctx.fillStyle = decorative ? 'rgba(0, 0, 0, 0.14)' : 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + radius * 0.8, radius * 1.15, radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      if (obstacle.type === 'pillar') {
        ctx.fillStyle = '#70859a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9bb1c8';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (obstacle.type === 'rubble') {
        ctx.fillStyle = '#665b57';
        ctx.fillRect(p.x - radius, p.y - radius * 0.55, radius * 1.2, radius * 0.9);
        ctx.fillRect(p.x - radius * 0.15, p.y - radius * 0.2, radius * 1.05, radius * 0.7);
      } else if (obstacle.type === 'altar') {
        ctx.fillStyle = '#8f734a';
        ctx.fillRect(p.x - radius * 0.9, p.y - radius * 0.6, radius * 1.8, radius * 1.2);
        ctx.strokeStyle = '#c7a878';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - radius * 0.9, p.y - radius * 0.6, radius * 1.8, radius * 1.2);
      } else if (obstacle.type === 'torch') {
        ctx.fillStyle = '#3d434f';
        ctx.fillRect(p.x - radius * 0.28, p.y - radius * 0.95, radius * 0.56, radius * 1.9);
        ctx.fillStyle = '#ffb347';
        ctx.beginPath();
        ctx.arc(p.x, p.y - radius * 0.95, radius * 0.42, 0, Math.PI * 2);
        ctx.fill();
      } else if (obstacle.type === 'banner') {
        ctx.fillStyle = '#766289';
        ctx.fillRect(p.x - radius * 0.3, p.y - radius * 0.9, radius * 0.6, radius * 1.8);
        ctx.fillStyle = '#c4a7db';
        ctx.fillRect(p.x - radius * 0.22, p.y - radius * 0.72, radius * 0.44, radius * 1.25);
      } else if (obstacle.type === 'fence') {
        ctx.fillStyle = '#6f6658';
        ctx.fillRect(p.x - radius, p.y - radius * 0.32, radius * 2, radius * 0.64);
      } else {
        ctx.fillStyle = decorative ? '#6f7a7d' : '#707e84';
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  _drawMapSetpieceOverlays(mapLayout, camX, camY) {
    const { ctx, width, height } = this;
    const tile = mapLayout.tileSize;
    const styleByType = {
      shrine_room: { color: '#7fd4ff', glyph: '+' },
      elite_ambush_room: { color: '#ff8e8e', glyph: '!' },
      cursed_chest_pocket: { color: '#d5a6ff', glyph: '$' },
      trap_antechamber: { color: '#ffd58e', glyph: '^' },
      vault_side_room: { color: '#ffe780', glyph: 'V' },
      boss_prelude_hall: { color: '#ff5f5f', glyph: 'B' },
    };

    for (const node of mapLayout.encounterMetadata?.setpieceNodes ?? []) {
      const style = styleByType[node.type] ?? { color: '#c7d2de', glyph: '?' };
      const world = mapLayout.tileToWorld(node.centerTile.tx, node.centerTile.ty);
      const p = this.toScreen(world.x, world.y);
      if (p.x < -tile || p.y < -tile || p.x > width + tile || p.y > height + tile) continue;

      const markerR = Math.max(7, tile * 0.22);
      ctx.save();
      ctx.fillStyle = `${style.color}22`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, markerR * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, markerR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = style.color;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(style.glyph, p.x, p.y + 0.5);
      ctx.restore();
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

  drawHoverHighlight(worldX, worldY, radius, color = '#8bd3ff', glowAlpha = 0.2, ringWidth = 2) {
    const { x, y } = this.toScreen(worldX, worldY);
    const { ctx } = this;
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.01);
    const ringR = Math.max(12, radius);
    ctx.save();
    ctx.globalAlpha = glowAlpha * pulse;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, ringR + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = Math.min(1, glowAlpha * 2.6);
    ctx.strokeStyle = color;
    ctx.lineWidth = ringWidth;
    ctx.beginPath();
    ctx.arc(x, y, ringR, 0, Math.PI * 2);
    ctx.stroke();
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

  drawMinimap(data) {
    if (!data) return;
    const { ctx, width, height } = this;
    const corner = data.mode === 'corner';
    const mobileLeft = data.mode === 'mobile-joystick';
    const margin = 18;
    // mobile-joystick: bottom-left panel sized to sit above the on-screen joystick
    // (joystick ≈ 124px tall + 14px bottom gap + 14px spacer = ~152px clearance)
    const mobileJoystickClearance = 152;
    const panelW = (corner || mobileLeft) ? Math.min(mobileLeft ? 148 : 220, width * (mobileLeft ? 0.22 : 0.24)) : width;
    const panelH = (corner || mobileLeft) ? Math.min(mobileLeft ? 148 : 220, height * (mobileLeft ? 0.22 : 0.24)) : height;
    const panelX = corner ? width - panelW - margin : (mobileLeft ? margin : 0);
    const panelY = corner ? height - panelH - margin : (mobileLeft ? height - panelH - mobileJoystickClearance : 0);
    const drawX = (corner || mobileLeft) ? panelX + 8 : width * 0.08;
    const drawY = (corner || mobileLeft) ? panelY + 8 : height * 0.1;
    const drawW = (corner || mobileLeft) ? panelW - 16 : width * 0.84;
    const drawH = (corner || mobileLeft) ? panelH - 16 : height * 0.8;
    const pxPerTile = (corner || mobileLeft) ? 4 : 10;
    const halfTilesX = drawW / (pxPerTile * 2);
    const halfTilesY = drawH / (pxPerTile * 2);
    const startTx = Math.max(0, Math.floor((data.playerX - halfTilesX * data.tileSize - data.worldLeft) / data.tileSize) - 1);
    const endTx = Math.min(data.cols - 1, Math.ceil((data.playerX + halfTilesX * data.tileSize - data.worldLeft) / data.tileSize) + 1);
    const startTy = Math.max(0, Math.floor((data.playerY - halfTilesY * data.tileSize - data.worldTop) / data.tileSize) - 1);
    const endTy = Math.min(data.rows - 1, Math.ceil((data.playerY + halfTilesY * data.tileSize - data.worldTop) / data.tileSize) + 1);

    const toMiniX = (worldX) => drawX + drawW / 2 + ((worldX - data.playerX) / data.tileSize) * pxPerTile;
    const toMiniY = (worldY) => drawY + drawH / 2 + ((worldY - data.playerY) / data.tileSize) * pxPerTile;

    ctx.save();
    if (!corner && !mobileLeft) {
      ctx.fillStyle = 'rgba(7, 11, 18, 0.18)';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.fillStyle = (corner || mobileLeft) ? 'rgba(9, 15, 24, 0.78)' : 'rgba(9, 15, 24, 0.32)';
    ctx.strokeStyle = (corner || mobileLeft) ? 'rgba(151, 184, 216, 0.45)' : 'rgba(151, 184, 216, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    if (corner || mobileLeft) ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(drawX, drawY, drawW, drawH);
    ctx.clip();

    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const idx = ty * data.cols + tx;
        if (!data.exploredMask?.[idx]) continue;
        const worldX = data.worldLeft + tx * data.tileSize;
        const worldY = data.worldTop + ty * data.tileSize;
        const sx = toMiniX(worldX);
        const sy = toMiniY(worldY);
        const tilePx = Math.max(2, pxPerTile);
        const isWall = data.source === 'map' ? data.tiles?.[ty]?.[tx] === 1 : false;
        ctx.fillStyle = isWall
          ? ((corner || mobileLeft) ? 'rgba(144, 163, 186, 0.4)' : 'rgba(144, 163, 186, 0.48)')
          : ((corner || mobileLeft) ? 'rgba(204, 226, 247, 0.2)' : 'rgba(204, 226, 247, 0.26)');
        ctx.fillRect(sx, sy, tilePx, tilePx);
      }
    }

    const sortedMarkers = [...(data.markers ?? [])].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    for (const marker of sortedMarkers) {
      const mx = toMiniX(marker.x);
      const my = toMiniY(marker.y);
      if (mx < drawX - 8 || my < drawY - 8 || mx > drawX + drawW + 8 || my > drawY + drawH + 8) continue;
      ctx.save();
      ctx.fillStyle = marker.color ?? '#ffffff';
      ctx.strokeStyle = 'rgba(12, 16, 22, 0.85)';
      ctx.lineWidth = 1;
      if (marker.type === 'player') {
        ctx.translate(mx, my);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-marker.size, -marker.size, marker.size * 2, marker.size * 2);
        ctx.strokeRect(-marker.size, -marker.size, marker.size * 2, marker.size * 2);
      } else if (marker.type === 'portal') {
        ctx.beginPath();
        ctx.arc(mx, my, marker.size + 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(mx, my, marker.size - 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (marker.type === 'boss' || marker.type === 'boss-room') {
        ctx.beginPath();
        ctx.moveTo(mx, my - marker.size - 1);
        ctx.lineTo(mx + marker.size + 1, my + marker.size + 1);
        ctx.lineTo(mx - marker.size - 1, my + marker.size + 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(mx, my, marker.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();

    ctx.strokeStyle = corner ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX, drawY, drawW, drawH);

    if (!corner && !mobileLeft && !data.mobileUi) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
      ctx.font = '600 13px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText('Press H to cycle minimap modes', width / 2, height - 28);
    }
    ctx.restore();
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
