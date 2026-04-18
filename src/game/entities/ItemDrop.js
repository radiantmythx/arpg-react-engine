/**
 * ItemDrop — a world-space ARPG-style nameplate pickup.
 * The orb body is gone — only the nameplate is rendered.
 * Click the plate to pick up the item.
 */
import { Entity } from './Entity.js';

const PULSE_SPEED = 1.8; // radians per second (used for glow animation)

/** Rarity text / accent colours (standard ARPG convention). */
const RARITY_COLORS = {
  unique: '#e8944a',
  rare:   '#ffe566',
  magic:  '#9999ff',
  normal: '#e0e0e0',
};

/** Rarity background tint — very subtle, just enough to hint at rarity. */
const RARITY_BG = {
  unique: 'rgba(90,40,5,0.65)',
  rare:   'rgba(60,50,0,0.65)',
  magic:  'rgba(20,20,70,0.65)',
  normal: 'rgba(10,10,20,0.72)',
};

const FONT_SIZE  = 13;           // px — main item name
const PLATE_PAD_X = 10;         // horizontal inner padding
const PLATE_PAD_Y = 5;          // vertical inner padding
const PLATE_H    = FONT_SIZE + PLATE_PAD_Y * 2;   // total plate height
const CORNER_R   = 4;           // rounded corner radius

export class ItemDrop extends Entity {
  constructor(x, y, itemDef) {
    super(x, y);
    this.itemDef = itemDef;
    this.radius  = 6;            // kept small — only affects world-space hover circle
    this.color   = itemDef.color ?? '#aaa';
    this._pulse  = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this._pulse += PULSE_SPEED * dt;
  }

  draw(renderer) {
    const { ctx } = renderer;
    const p       = renderer.toScreen(this.x, this.y);
    const rarity  = this.itemDef.rarity ?? 'normal';
    const name    = this.itemDef.name   ?? 'Item';
    const accent  = RARITY_COLORS[rarity] ?? RARITY_COLORS.normal;
    const bgColor = RARITY_BG[rarity]    ?? RARITY_BG.normal;

    ctx.save();
    ctx.font         = `700 ${FONT_SIZE}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    const textW  = ctx.measureText(name).width;
    const plateW = textW + PLATE_PAD_X * 2;
    const plateX = p.x - plateW / 2;
    const plateY = p.y - PLATE_H / 2;   // centred on the world-space anchor point

    // ── Subtle animated outer glow ────────────────────────────────────────
    const glowA = 0.18 + 0.12 * Math.sin(this._pulse);
    ctx.shadowColor = accent;
    ctx.shadowBlur  = 10 + 6 * Math.sin(this._pulse);
    ctx.globalAlpha = glowA;
    ctx.fillStyle   = accent;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(plateX - 2, plateY - 2, plateW + 4, PLATE_H + 4, CORNER_R + 2);
    else ctx.rect(plateX - 2, plateY - 2, plateW + 4, PLATE_H + 4);
    ctx.fill();

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    // ── Background fill ───────────────────────────────────────────────────
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(plateX, plateY, plateW, PLATE_H, CORNER_R);
    else ctx.rect(plateX, plateY, plateW, PLATE_H);
    ctx.fill();

    // ── Rarity-coloured top edge stripe ──────────────────────────────────
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(plateX, plateY, plateW, 2, [CORNER_R, CORNER_R, 0, 0]);
    else ctx.rect(plateX, plateY, plateW, 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── Border ────────────────────────────────────────────────────────────
    ctx.strokeStyle = accent;
    ctx.lineWidth   = 1.2;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(plateX, plateY, plateW, PLATE_H, CORNER_R);
    else ctx.rect(plateX, plateY, plateW, PLATE_H);
    ctx.stroke();

    // ── Item name ─────────────────────────────────────────────────────────
    ctx.globalAlpha = 1;
    // Soft shadow for legibility
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur  = 4;
    ctx.fillStyle   = accent;
    ctx.fillText(name, p.x, plateY + PLATE_H / 2 + 0.5);

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /**
   * Screen-space bounding box of the nameplate for hover/click detection.
   */
  getNameplateBounds(renderer) {
    const p = renderer.toScreen(this.x, this.y);
    const { ctx } = renderer;
    ctx.save();
    ctx.font = `700 ${FONT_SIZE}px sans-serif`;
    const textW  = ctx.measureText(this.itemDef.name ?? 'Item').width;
    ctx.restore();
    const plateW = textW + PLATE_PAD_X * 2;
    const plateH = PLATE_H;
    return {
      left:   p.x - plateW / 2 - 4,
      right:  p.x + plateW / 2 + 4,
      top:    p.y - plateH / 2 - 4,
      bottom: p.y + plateH / 2 + 4,
    };
  }
}


