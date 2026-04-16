/**
 * FireStrike — Warrior starter auto-fire skill.
 *
 * Melee arc attack with mostly Physical damage and a small Blaze component.
 * Tags: Attack, Melee, Physical, Blaze, AoE.
 */
import { Skill } from './Skill.js';
import { WEAPONS } from '../config.js';
import { makeDamageRange } from '../damageUtils.js';
import { applyAilmentsOnHit, resolvePenetrationMap } from '../data/skillTags.js';

const SLASH_DURATION = 0.25;
const ARC_HALF_ANGLE = Math.PI / 5;

export class FireStrike extends Skill {
  constructor() {
    super(WEAPONS.FIRE_STRIKE);
    this.tags = ['Attack', 'Melee', 'Physical', 'Blaze', 'AoE'];
    this._timer = this.cooldown;
    this._slashAge = null;
    this._slashX = 0;
    this._slashY = 0;
    this._slashAngle = 0;
  }

  update(dt, player, entities, engine) {
    if (this._slashAge !== null) {
      this._slashAge += dt;
      if (this._slashAge >= SLASH_DURATION) this._slashAge = null;
    }
    super.update(dt, player, entities, engine);
  }

  fire(player, entities, engine) {
    const stats = this.computedStats(player);
    const totalDamage = Number(stats.damage ?? this.damage ?? 0);
    const physicalPortion = Math.max(0, totalDamage * 0.85);
    const blazePortion = Math.max(0, totalDamage * 0.15);
    const hitBreakdown = {
      Physical: makeDamageRange(physicalPortion, 'Physical'),
      Blaze: makeDamageRange(blazePortion, 'Blaze'),
    };
    const hitDamage = Math.round(physicalPortion + blazePortion);
    const penMap = resolvePenetrationMap(this.tags, player);

    let dirX = player.facingX ?? 1;
    let dirY = player.facingY ?? 0;
    const dirLen = Math.hypot(dirX, dirY);
    if (dirLen < 0.0001) {
      dirX = 1;
      dirY = 0;
    } else {
      dirX /= dirLen;
      dirY /= dirLen;
    }

    const aimAngle = Math.atan2(dirY, dirX);
    const minDot = Math.cos(ARC_HALF_ANGLE);
    let hit = false;

    for (const enemy of entities.getHostiles()) {
      if (!enemy.active) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distSq = dx * dx + dy * dy;
      const effectiveR = this.config.strikeRadius + (enemy.radius ?? 0);
      if (distSq > effectiveR * effectiveR) continue;

      const dist = Math.sqrt(distSq);
      const dot = dist > 0.001 ? (dx * dirX + dy * dirY) / dist : 1;
      if (dot >= minDot) {
        if (engine) engine.onEnemyHit(enemy, hitDamage);
        enemy.takeDamage(hitBreakdown, this.tags, penMap);
        applyAilmentsOnHit(this.tags, hitBreakdown, enemy, player);
        hit = true;
        if (!enemy.active) engine.onEnemyKilled(enemy);
      }
    }

    this._slashX = player.x;
    this._slashY = player.y;
    this._slashAngle = aimAngle;
    this._slashAge = 0;
    if (hit && engine) engine.onSkillFire();
  }

  draw(renderer) {
    if (this._slashAge === null) return;
    const t = this._slashAge / SLASH_DURATION;
    const r = this.config.strikeRadius * (0.55 + t * 0.55);
    const alpha = 0.8 * (1 - t);
    const { ctx } = renderer;
    const p = renderer.toScreen(this._slashX, this._slashY);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.config.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, this._slashAngle - ARC_HALF_ANGLE, this._slashAngle + ARC_HALF_ANGLE);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  _applyLevelStats() {
    const table = {
      2: { damage: 32, strikeRadius: 80 },
      3: { damage: 44, strikeRadius: 88, cooldown: 1.30 },
      4: { damage: 58, strikeRadius: 96, cooldown: 1.16 },
      5: { damage: 75, strikeRadius: 108, cooldown: 1.03 },
    };
    const s = table[this.level];
    if (!s) return;
    if (s.damage      !== undefined) this.damage   = s.damage;
    if (s.cooldown    !== undefined) this.cooldown = s.cooldown;
    if (s.strikeRadius !== undefined) this.config = { ...this.config, strikeRadius: s.strikeRadius };
  }
}
