/**
 * Weapon — base class for all auto-fire and active skills implemented as
 * weapons (Attack-tagged skills).  Pure SkillDefs live in skills.js.
 *
 * Subclasses override fire(player, entities) to spawn their effect.
 * Subclasses override _applyLevelStats() to improve stats on level up.
 *
 * `tags` — string[] populated by each subclass constructor; drives support
 * gem compatibility, passive tree scaling, and ailment application.
 * Use the TAGS constants from skillTags.js when setting them.
 */
export class Weapon {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.level = 1;
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
    /** Reserved for future resource system. */
    this.manaCost = config.manaCost ?? 0;
    /**
     * Support gem sockets.  Starts with 1 slot; gains more at levels 4/7/10/14/18.
     * Each entry is null (empty) or a SkillSupport instance.
     * @type {Array<null|object>}
     */
    this.supportSlots = [null];

    /**
     * Skill identity tags — set by each subclass.
     * @type {string[]}
     */
    this.tags = [];
    /**
     * When true this weapon is a hotbar active skill and will NOT auto-fire.
     * activeSkillSystem calls fire() directly on key press.
     */
    this.isActive = false;
  }

  /**
   * Compute the final runtime stats for this weapon at fire time.
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
    const stats = { ...this.config, damage: this.damage };

    // Apply support gem modifiers
    for (const support of this.supportSlots) {
      if (support?.modify) support.modify(stats, this);
    }

    // Player tag-based "increased" multipliers (additive pool, applied once)
    if (player) {
      let inc = 0;
      if (this.tags.includes('Spell')   && (player.spellDamage  ?? 0) > 0) inc += player.spellDamage;
      if (this.tags.includes('Attack')  && (player.attackDamage ?? 0) > 0) inc += player.attackDamage;
      if (this.tags.includes('AoE')     && (player.aoeDamage    ?? 0) > 0) inc += player.aoeDamage;
      if (inc > 0) stats.damage = Math.round(stats.damage * (1 + inc));
    }

    return stats;
  }

  /**
   * Called every frame. Accumulates time and fires when cooldown is reached.
   * @param {number} dt - delta time in seconds
   * @param {import('../entities/Player.js').Player} player
   * @param {import('../EntityManager.js').EntityManager} entities
   * @param {import('../GameEngine.js').GameEngine} engine
   */
  update(dt, player, entities, engine) {
    this._timer += dt;
    // Active skills only fire when triggered by the hotbar, not automatically.
    if (!this.isActive && this._timer >= this.cooldown) {
      this._timer -= this.cooldown; // carry over remainder to keep rhythm steady
      this.fire(player, entities, engine);
    }
  }

  /** Override in subclasses to produce the weapon's effect. */
  fire(_player, _entities, _engine) {}

  /**
   * Called each render frame for weapons that need to draw auras, rings, or zones.
   * Override in subclasses; no-op by default.
   */
  draw(_renderer, _player) {}

  levelUp() {
    this.level++;
    this._applyLevelStats();
  }

  /** Override in subclasses to apply per-level stat improvements. */
  _applyLevelStats() {}
}
