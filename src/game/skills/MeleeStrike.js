/**
 * MeleeStrike — Warrior's default auto-fire starter skill.
 *
 * Slashes enemies in a short directional arc on cooldown.
 * Plays a brief arc visual to communicate direction and reach.
 * Tags: Attack, Melee, Physical, AoE.
 */
import { Skill } from './Skill.js';
import { WEAPONS } from '../config.js';
import { applyAilmentsOnHit, resolvePenetrationMap } from '../data/skillTags.js';

const SLASH_DURATION = 0.25; // seconds for the visual ring to fade out
const ARC_HALF_ANGLE = Math.PI / 5; // ~36 degrees (72-degree arc)

export class MeleeStrike extends Skill {
  constructor() {
    super(WEAPONS.MELEE_STRIKE);
    this.tags = ['Attack', 'Melee', 'Physical', 'AoE'];
    // isActive = false (default) — fires automatically on cooldown.
    this._timer = this.cooldown; // start ready
    /** Visual slash ring state. null = hidden. */
    this._slashAge = null;
    this._slashX = 0;
    this._slashY = 0;
    this._slashAngle = 0;
    this._slashRadius = this.config.strikeRadius;
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
    const hitDamage = stats.damage;
    const hitBreakdown = stats.damageBreakdown;
    const strikeRadius = Math.max(8, Number(stats.strikeRadius ?? this.config.strikeRadius ?? 0));
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
      // Extend reach by the enemy's own radius so the strike connects when touching any enemy,
      // including large bosses whose body extends well beyond their centre-point.
      const effectiveR = strikeRadius + (enemy.radius ?? 0);
      if (distSq > effectiveR * effectiveR) continue;

      const dist = Math.sqrt(distSq);
      const dot = dist > 0.001 ? (dx * dirX + dy * dirY) / dist : 1;
      if (dot >= minDot) {
        if (engine) engine.onEnemyHit(enemy, hitDamage);
        enemy.takeDamage(hitBreakdown ?? hitDamage, this.tags, penMap);
        applyAilmentsOnHit(this.tags, hitBreakdown ?? hitDamage, enemy, player);
        hit = true;
        if (!enemy.active) engine.onEnemyKilled(enemy);
      }
    }

    // Trigger visual even when no enemies are in range (swing animation).
    this._slashX = player.x;
    this._slashY = player.y;
    this._slashAngle = aimAngle;
    this._slashRadius = strikeRadius;
    this._slashAge = 0;
    if (hit && engine) engine.onSkillFire();
  }

  draw(renderer, _player) {
    if (this._slashAge === null) return;
    const t = this._slashAge / SLASH_DURATION;  // 0 → 1
    const baseRadius = Math.max(8, Number(this._slashRadius ?? this.config.strikeRadius ?? 0));
    const r = baseRadius * (0.55 + t * 0.55);
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
      2: { damage: 35, strikeRadius: 80 },
      3: { damage: 48, strikeRadius: 88, castTime: 0.38 },
      4: { damage: 64, strikeRadius: 96, castTime: 0.32 },
      5: { damage: 85, strikeRadius: 110, castTime: 0.26 },
    };
    const s = table[this.level];
    if (!s) return;
    if (s.damage       !== undefined) this.damage    = s.damage;
    if (s.castTime     !== undefined) this.castTime  = s.castTime;
    if (s.strikeRadius !== undefined) this.config    = { ...this.config, strikeRadius: s.strikeRadius };
  }
}
