import { makeSupportInstance } from './data/supports.js';

/**
 * ActiveSkillSystem — Manages 3 active skill slots (Q / E / R).
 *
 * Each slot holds one of:
 *   • A Weapon instance with `isActive = true` (weapon-based active skill).
 *     Cooldown is tracked by the weapon's own `_timer` / `cooldown` fields.
 *   • A SkillDef instance with `_isPureSkill = true`.
 *     Cooldown is tracked by the skill's own `_timer` field, advanced here.
 *   • null (empty slot).
 *
 * Key bindings: Q → slot 0, E → slot 1, R → slot 2
 */
export class ActiveSkillSystem {
  constructor() {
    /** @type {[object|null, object|null, object|null]} */
    this.slots = [null, null, null];

    /**
     * Per-slot cast animation timers (Phase 12.3).
     * null  = not casting; { remaining: number, action: function } = mid-cast.
     * @type {[{remaining:number, action:function}|null, ...]}
     */
    this._castingTimers = [null, null, null];
  }

  // ── Slot management ──────────────────────────────────────────────────────

  /**
   * Equip a weapon or skill into the given slot index (0, 1, or 2).
   * For pure skills, resets the cooldown timer so the skill is ready immediately.
   * @param {object} skillOrWeapon
   * @param {number} slotIdx
   */
  equip(skillOrWeapon, slotIdx) {
    this.slots[slotIdx] = skillOrWeapon;
    if (skillOrWeapon?._isPureSkill) {
      skillOrWeapon._timer = skillOrWeapon.cooldown; // ready immediately
    }
  }

  /** Remove the skill/weapon from a slot without destroying it. */
  unequip(slotIdx) {
    this.slots[slotIdx] = null;
  }

  /** @returns {number} index of first empty slot, or -1 if all full */
  firstEmptySlot() {
    return this.slots.findIndex((s) => s === null);
  }

  // ── State queries ────────────────────────────────────────────────────────

  /** True if a weapon with the given id is equipped in any slot. */
  hasWeaponSkill(id) {
    return this.slots.some((s) => s && !s._isPureSkill && s.id === id);
  }

  /** True if a pure skill with the given id is equipped in any slot. */
  hasPureSkill(id) {
    return this.slots.some((s) => s && s._isPureSkill && s.id === id);
  }

  // ── Per-frame update ─────────────────────────────────────────────────────

  /**
   * Advance cooldown timers for pure-skill slots, tick cast animation timers,
   * and call the optional update() hook on skills with timed internal state
   * (Earthquake aftershock, Blade Flurry channel release, Vortex tick).
   * Weapon-slot timers are advanced by GameEngine's main weapon loop.
   * @param {number} dt
   * @param {object} [player]
   * @param {object} [entities]
   * @param {object} [engine]
   */
  update(dt, player, entities, engine) {
    for (const slot of this.slots) {
      if (slot?._isPureSkill && slot._timer < slot.cooldown) {
        slot._timer = Math.min(slot.cooldown, slot._timer + dt);
      }
      // Skills with timed internal state (Earthquake, BladeFlurry, Vortex)
      if (slot?._isPureSkill && typeof slot.update === 'function') {
        slot.update(dt, player, entities, engine);
      }
    }

    // Tick cast animation timers (Phase 12.3)
    for (let i = 0; i < 3; i++) {
      const ct = this._castingTimers[i];
      if (!ct) continue;
      ct.remaining -= dt;
      if (ct.remaining <= 0) {
        ct.action();
        this._castingTimers[i] = null;
      }
    }
  }

  // ── Activation ───────────────────────────────────────────────────────────

  /**
   * Attempt to activate the skill in the given slot.
   *
   * If the skill has a non-zero castTime the effect is deferred by
   * actualCastTime = skill.castTime / castSpeed, where castSpeed is
   * player.attackSpeed for Attack-tagged skills and player.castSpeed otherwise.
   * The slot is locked for re-activation during the cast animation.
   *
   * @param {number} slotIdx         — 0, 1, or 2
   * @param {import('../entities/Player.js').Player} player
   * @param {import('../EntityManager.js').EntityManager} entities
   * @param {import('../GameEngine.js').GameEngine} engine
   * @returns {boolean} true if the skill started firing (or began casting)
   */
  activate(slotIdx, player, entities, engine) {
    const skill = this.slots[slotIdx];
    if (!skill) return false;

    // Block re-activation while a cast is already in progress for this slot
    if (this._castingTimers[slotIdx]) return false;

    // Determine cast speed divisor by tag
    const isAttack = skill.tags?.includes('Attack');
    const speed = isAttack ? (player.attackSpeed ?? 1.0) : (player.castSpeed ?? 1.0);
    const actualCastTime = (skill.castTime ?? 0) / speed;

    if (skill._isPureSkill) {
      if (skill._timer < skill.cooldown) return false;

      if (actualCastTime > 0.01) {
        this._castingTimers[slotIdx] = {
          remaining: actualCastTime,
          action: () => {
            skill.activate(player, entities, engine);
            skill._timer = 0; // cooldown starts after cast lands
            for (const sup of skill.supportSlots ?? []) {
              sup?.onActivate?.(player, entities, engine, skill);
            }
          },
        };
        return true;
      }

      skill.activate(player, entities, engine);
      skill._timer = 0;
      // Fire support onActivate hooks
      for (const sup of skill.supportSlots ?? []) {
        sup?.onActivate?.(player, entities, engine, skill);
      }
      return true;
    }

    // Weapon-based active skill: uses the weapon's own _timer
    if (skill.isActive) {
      if (skill._timer < skill.cooldown) return false;

      if (actualCastTime > 0.01) {
        this._castingTimers[slotIdx] = {
          remaining: actualCastTime,
          action: () => {
            skill.fire(player, entities, engine);
            skill._timer = 0; // cooldown starts after cast lands
          },
        };
        return true;
      }

      skill.fire(player, entities, engine);
      skill._timer = 0;
      return true;
    }

    return false;
  }

  // ── Skill XP & levelling ─────────────────────────────────────────────────

  /**
   * Grant XP to all equipped pure skills.
   * XP formula: split evenly among equipped pure skills so each kill
   * grants 1 XP per equipped skill (enemies worth more give more).
   * @param {number} amount — total XP to distribute
   */
  grantSkillXP(amount) {
    for (const slot of this.slots) {
      if (slot?._isPureSkill && typeof slot.addXP === 'function') {
        slot.addXP(amount);
      }
    }
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  /**
   * Reset cooldown timers for ALL pure skills.
   * Called by Arcane Surge.
   */
  resetTimers() {
    for (const slot of this.slots) {
      if (slot) slot._timer = slot.cooldown ?? slot._timer;
    }
  }

  // ── Serialization (for HUD) ──────────────────────────────────────────────

  /**
   * Returns a plain-data array of 3 slot summaries for React.
   * `casting` is the remaining cast animation time in seconds (0 when not casting).
   * `ready` is false while the cooldown is running OR while casting.
   * @returns {Array<{id, name, icon, cooldown, remaining, ready, casting} | null>}
   */
  serialize() {
    return this.slots.map((s, i) => {
      if (!s) return null;
      const remaining = Math.max(0, s.cooldown - s._timer);
      const ct = this._castingTimers[i];
      const supportSlots = (s.supportSlots ?? []).map((sup) =>
        sup ? { id: sup.id, name: sup.name, icon: sup.icon ?? '◆' } : null
      );
      return {
        id:           s.id,
        name:         s.name,
        icon:         s.icon ?? '⚡',
        description:  s.description ?? '',
        tags:         s.tags ?? [],
        cooldown:     s.cooldown,
        remaining:    parseFloat(remaining.toFixed(1)),
        ready:        remaining <= 0 && !ct,
        casting:      ct ? parseFloat(Math.max(0, ct.remaining).toFixed(2)) : 0,
        openSlots:    (s.supportSlots ?? []).length,
        supportSlots,
        // XP / levelling fields
        level:        s.level ?? 1,
        maxLevel:     s.maxLevel ?? 20,
        xp:           s._xp ?? 0,
        xpToNext:     (s.level ?? 1) < (s.maxLevel ?? 20)
                        ? (s.constructor.xpNeeded?.(s.level ?? 1) ?? 0)
                        : 0,
        isMaxLevel:   (s.level ?? 1) >= (s.maxLevel ?? 20),
        maxLevelBonus: s.maxLevelBonus ?? null,
      };
    });
  }

  // ── Full serialization (for CharacterSave) ──────────────────────────────

  /**
   * Returns a deep-save representation of the three skill slots,
   * including gem levels, XP, and socketed support gem data.
   * Distinct from serialize() which produces lightweight HUD data.
   * @returns {Array<object|null>}
   */
  serializeFull() {
    return this.slots.map((s) => {
      if (!s) return null;
      if (s._isPureSkill) {
        return {
          type:  'pure_skill',
          id:    s.id,
          level: s.level  ?? 1,
          xp:    s._xp    ?? 0,
          supportSlots: (s.supportSlots ?? []).map((sup) => {
            if (!sup) return null;
            // Store just enough to reconstruct: id + any override fields.
            return {
              id:   sup.id,
              name: sup.name,
              icon: sup.icon ?? '◆',
            };
          }),
        };
      }
      // weapon-based active skill
      return {
        type: 'weapon',
        id:   s.id,
      };
    });
  }

  // ── Support gem socket management ────────────────────────────────────────

  /** @returns {object|null} The live skill def with the given id, or null. */
  findSkillById(skillId) {
    return this.slots.find((s) => s?.id === skillId) ?? null;
  }

  /**
   * Place a support gem instance into a skill's supportSlots array.
   * Any gem already in that slot is displaced (caller should handle returning it).
   */
  socketGem(skillId, slotIndex, gemItemDef) {
    const skill = this.findSkillById(skillId);
    if (!skill) return false;
    if (!Array.isArray(skill.supportSlots) || slotIndex >= skill.supportSlots.length) return false;
    const instance = makeSupportInstance(gemItemDef);
    if (!instance) return false;
    skill.supportSlots[slotIndex] = instance;
    return true;
  }

  /**
   * Remove the support gem from a skill slot.
   * @returns {object|null} The original item def (for returning to inventory), or null.
   */
  unsocketGem(skillId, slotIndex) {
    const skill = this.findSkillById(skillId);
    if (!skill || !Array.isArray(skill.supportSlots)) return null;
    const instance = skill.supportSlots[slotIndex];
    if (!instance) return null;
    skill.supportSlots[slotIndex] = null;
    return instance._itemDef ?? null;
  }
}
