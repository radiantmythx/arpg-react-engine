import { ELEMENT_TYPES, makeDamageRange, sumAverageDamageMap } from '../damageUtils.js';
import { MAX_SUPPORT_SOCKETS, openSupportSlotsForLevel } from '../supportSockets.js';
import { resolveScopedSkillBonuses } from '../data/modifierEngine.js';

/**
 * Skill — base class for all auto-fire and active runtime skills.
 * Pure SkillDefs live in skills.js.
 *
 * Subclasses override fire(player, entities) to spawn their effect.
 * Subclasses override _applyLevelStats() to improve stats on level up.
 *
 * `tags` — string[] populated by each subclass constructor; drives support
 * gem compatibility, passive tree scaling, and ailment application.
 * Use the TAGS constants from skillTags.js when setting them.
 */
export class Skill {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.level = 1;
    this._xp = 0;
    this.maxLevel = 20;
    this.cooldown = config.cooldown;
    this.damage = config.damage;
    this.config = config;
    this._timer = 0;

    // ── Phase 12.2 stat formula ─────────────────────────────────────────────
    /** Base numeric values at level 1.  Used by computedStats() as the scaling origin. */
    this.base     = config.base     ?? { damage: config.damage };
    /** Per-key scaling rules: { statKey: { flat, pct } } */
    this.scaling  = config.scaling  ?? {};
    /** Seconds from activation press to effect delivery (0 = instant for auto-fire). */
    this.castTime = config.castTime ?? 0;
    /** Resource cost used by active skills. */
    this.manaCost = config.manaCost ?? 0;
    /** Optional equip requirements for activation gating. */
    this.requiresWeaponType = Array.isArray(config.requiresWeaponType) ? [...config.requiresWeaponType] : [];
    this.requirementHint = config.requirementHint ?? null;
    /**
     * Support gem sockets. Open sockets scale by gem level:
     * level 1 = 1, 4 = 2, 7 = 3, 10 = 4, 13+ = 5.
     * @type {Array<null|object>}
     */
    this.supportSlots = Array(MAX_SUPPORT_SOCKETS).fill(null);

    /**
     * Skill identity tags — set by each subclass.
     * @type {string[]}
     */
    this.tags = [];
    /**
    * When true this runtime skill is a hotbar active skill and will NOT auto-fire.
     * activeSkillSystem calls fire() directly on key press.
     */
    this.isActive = false;
  }

  /**
  * Compute the final runtime stats for this skill at fire time.
   *
   * For `damage`: uses the live `this.damage` value (which already holds any
   * passive-item or BloodPact multipliers), then layers support mods and
   * player tag-based "increased" bonuses on top.
   * For all other base stats: computed freshly from `this.base` + level scaling.
   *
   * Note — fire() methods currently read `this.damage` and `this.config` directly.
   * Migrate fire() calls to use computedStats() when support gems are wired (Phase 12.5).
   *
   * @param {import('../entities/Player.js').Player} [player]
   * @returns {object} snapshot of computed stats — safe to read and discard
   */
  computedStats(player) {
    // Start with all config fields as baseline, overriding damage with live value
    const stats = { ...this.config, damage: this.damage, manaCost: this.manaCost };

    // Apply support gem modifiers
    for (const support of this.supportSlots) {
      if (support?.modify) support.modify(stats, this);
    }

    // Player tag-based bonuses — domain (Spell/Attack/AoE) + per-element flat/increased/more
    if (player) {
      const scoped = resolveScopedSkillBonuses(player, this);
      let domainInc = 0;
      if (this.tags.includes('Spell')  && (player.spellDamage  ?? 0) > 0) domainInc += player.spellDamage;
      if (this.tags.includes('Attack') && (player.attackDamage ?? 0) > 0) domainInc += player.attackDamage;
      if (this.tags.includes('AoE')    && (player.aoeDamage    ?? 0) > 0) domainInc += player.aoeDamage;
      domainInc += scoped.damageInc;

      // Flat passive-tree AoE bonus applies to all radius-like fields used by skills.
      if ((player.aoeSizeFlat ?? 0) !== 0) {
        for (const key of ['radius', 'pillarRadius', 'meleeRadius', 'impactRadius', 'afterRadius']) {
          if (stats[key] != null) stats[key] = Math.max(1, Math.round(stats[key] + player.aoeSizeFlat));
        }
      }

      if (this.tags.includes('Melee') && (player.meleeStrikeRange ?? 0) !== 0) {
        const rangeMult = Math.max(0.1, 1 + Number(player.meleeStrikeRange ?? 0));
        for (const key of ['strikeRadius', 'meleeRadius']) {
          if (stats[key] != null) stats[key] = Math.max(1, Math.round(stats[key] * rangeMult));
        }
      }

      const activeElems = ELEMENT_TYPES.filter((e) => this.tags.includes(e));
      const typedElems = activeElems.length > 0 ? activeElems : ['Physical'];
      if (stats.damage != null) {
        // Always produce typed damage maps so resistance/ailment pipelines can reason by type.
        const basePer = stats.damage / typedElems.length;
        const breakdown = {};
        for (const elem of typedElems) {
          const flat = player[`flat${elem}Damage`] ?? 0;
          const elemInc = player[`increased${elem}Damage`] ?? 0;
          const more = player[`more${elem}Damage`] ?? 0;
          const baseTyped = (basePer + flat) * (1 + domainInc + elemInc) * (1 + more);
          breakdown[elem] = makeDamageRange(baseTyped, elem);
        }
        stats.damageBreakdown = breakdown;
        stats.damage = Math.round(sumAverageDamageMap(breakdown));
        const mins = Object.values(breakdown).map((r) => r.min ?? 0);
        const maxs = Object.values(breakdown).map((r) => r.max ?? 0);
        stats.damageRange = { min: mins.reduce((a, b) => a + b, 0), max: maxs.reduce((a, b) => a + b, 0) };
      }
    } else {
      stats.damageBreakdown = null;
      if (stats.damage != null) stats.damageRange = { min: Math.round(stats.damage), max: Math.round(stats.damage) };
    }

    return stats;
  }

  /**
   * Called every frame. Accumulates time and fires when cooldown is reached.
   * For skills with a castTime, enters a casting phase that freezes the player
   * and fills a cast bar before delivering the effect.
   * @param {number} dt - delta time in seconds
   * @param {import('../entities/Player.js').Player} player
   * @param {import('../EntityManager.js').EntityManager} entities
   * @param {import('../GameEngine.js').GameEngine} engine
   */
  update(dt, player, entities, engine) {
    // ── Active cast in progress ──────────────────────────────────────────
    if (this._castElapsed != null) {
      this._castElapsed += dt;
      const castDuration = this._castDuration ?? 0;
      // Update player casting state each frame so it persists while we cast
      player.casting = { elapsed: this._castElapsed, duration: castDuration };
      if (this._castElapsed >= castDuration) {
        // Cast complete — deliver the skill
        this._castElapsed = null;
        this._castDuration = null;
        player.casting = null;
        this.fire(player, entities, engine);
      }
      return;
    }

    this._timer += dt;
    // Active skills only fire when triggered by the hotbar, not automatically.
    if (!this.isActive && this._timer >= this.cooldown) {
      const ct = this.castTime ?? this.config.castTime ?? 0;
      if (ct > 0) {
        // If another skill is already casting, hold — don't decrement timer yet.
        // This queues the cast naturally: when the player is free it fires.
        if (player.casting) return;
        this._timer -= this.cooldown;
        this._castElapsed = 0;
        this._castDuration = ct;
        player.casting = { elapsed: 0, duration: ct };
      } else {
        this._timer -= this.cooldown; // carry over remainder to keep rhythm steady
        this.fire(player, entities, engine);
      }
    }
  }

  /** Override in subclasses to produce the skill's effect. */
  fire(_player, _entities, _engine) {}

  /**
   * Tick any in-progress cast. Call at the TOP of overriding update() methods.
   * Returns true if currently casting (caller should return early — no other logic).
   */
  _tickCast(dt, player, entities, engine) {
    if (this._castElapsed == null) return false;
    this._castElapsed += dt;
    player.casting = { elapsed: this._castElapsed, duration: this._castDuration ?? 0 };
    if (this._castElapsed >= (this._castDuration ?? 0)) {
      this._castElapsed = null;
      this._castDuration = null;
      player.casting = null;
      this.fire(player, entities, engine);
    }
    return true;
  }

  /**
   * Attempt to start a cast or fire immediately. Call when cooldown has elapsed.
   * If this skill has a castTime and player is already casting, returns false and does
   * NOT decrement the timer — the caller should skip so the skill retries next frame.
   * @returns {boolean} true if the cast started or the skill already fired
   */
  _claimCooldownAndCastOrFire(player, entities, engine) {
    const ct = this.castTime ?? this.config?.castTime ?? 0;
    if (ct > 0) {
      if (player.casting) return false; // player busy — retry next frame
      this._timer -= this.cooldown;
      this._castElapsed = 0;
      this._castDuration = ct;
      player.casting = { elapsed: 0, duration: ct };
      return true;
    }
    // No cast time — fire instantly
    this._timer -= this.cooldown;
    this.fire(player, entities, engine);
    return true;
  }

  /**
  * Called each render frame for skills that need to draw auras, rings, or zones.
   * Override in subclasses; no-op by default.
   */
  draw(_renderer, _player) {}

  static xpNeeded(level) {
    return Math.round(100 * Math.pow(level, 1.8));
  }

  static slotsForLevel(level) {
    return openSupportSlotsForLevel(level);
  }

  addXP(amount) {
    if (this.level >= this.maxLevel) return false;
    this._xp += amount;
    let levelled = false;
    while (this.level < this.maxLevel) {
      const needed = Skill.xpNeeded(this.level);
      if (this._xp < needed) break;
      this._xp -= needed;
      this.levelUp();
      levelled = true;
    }
    if (this.level >= this.maxLevel) this._xp = 0;
    return levelled;
  }

  levelUp() {
    this.level++;
    this._applyLevelStats();
  }

  /** Override in subclasses to apply per-level stat improvements. */
  _applyLevelStats() {}
}


// Backward compatibility alias during Phase 1 rename.
export { Skill as Weapon };
