import { Entity } from './Entity.js';
import { PLAYER } from '../config.js';
import { ArcaneLance }    from '../skills/ArcaneLance.js';
import { PhantomBlade }   from '../skills/PhantomBlade.js';
import { RighteousPyre }  from '../skills/RighteousPyre.js';
import { TectonicCleave } from '../skills/TectonicCleave.js';
import { SacredRite }     from '../skills/SacredRite.js';
import { VoltaicArc }     from '../skills/VoltaicArc.js';
import { MagicBolt }      from '../skills/MagicBolt.js';
import { SwiftArrow }     from '../skills/SwiftArrow.js';
import { MeleeStrike }    from '../skills/MeleeStrike.js';
import { FrostArrow }     from '../skills/FrostArrow.js';
import { FireStrike }     from '../skills/FireStrike.js';
import { PassiveItem } from '../PassiveItem.js';
import { InventoryGrid } from '../InventoryGrid.js';
import { applyStats, TREE_NODE_MAP } from '../data/passiveTree.js';
import {
  canEquipItemInSlot,
  normalizeEquipSlotAlias,
  normalizeWeaponItem,
} from '../data/weaponTypes.js';

/** Maps runtime skill ids to skill constructors. */
const AUTO_SKILL_REGISTRY = {
  // Starter skills (cast via Space as primary skill)
  MAGIC_BOLT:      () => new MagicBolt(),
  SWIFT_ARROW:     () => new SwiftArrow(),
  MELEE_STRIKE:    () => new MeleeStrike(),
  FROST_ARROW:     () => new FrostArrow(),
  FIRE_STRIKE:     () => new FireStrike(),
  // Original active runtime skills (also available via skill offer)
  ARCANE_LANCE:    () => new ArcaneLance(),
  PHANTOM_BLADE:   () => new PhantomBlade(),
  RIGHTEOUS_PYRE:  () => new RighteousPyre(),
  TECTONIC_CLEAVE: () => new TectonicCleave(),
  SACRED_RITE:     () => new SacredRite(),
  VOLTAIC_ARC:     () => new VoltaicArc(),
};

export class Player extends Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {import('../data/characters.js').CharacterDef|null} characterDef
   */
  constructor(x, y, characterDef = null) {
    super(x, y);
    this.characterId = characterDef?.id ?? 'sage';
    this.radius = PLAYER.RADIUS;
    this.speed = characterDef?.baseStats?.speed ?? PLAYER.SPEED;
    this.terrainSpeedMult = 1;
    this.health = characterDef?.baseStats?.maxHealth ?? PLAYER.MAX_HEALTH;
    this.maxHealth = characterDef?.baseStats?.maxHealth ?? PLAYER.MAX_HEALTH;
    this.maxMana = characterDef?.baseStats?.maxMana ?? PLAYER.MAX_MANA;
    this.mana = this.maxMana;
    this._manaSpentCounter = 0;
    this._manaRegenCounter = 0;
    this.xp = 0;
    this.level = 1;
    this.xpToNext = 10; // synced with LEVEL_XP_TABLE[1]
    this.gold = 0;

    // Last non-zero aim direction (updated from cursor each frame by GameEngine)
    this.facingX = 1;
    this.facingY = 0;

    // Invulnerability frames in seconds — prevents rapid damage spam from enemies
    this.invulnerable = 0;

    // Casting state — set by skills/ActiveSkillSystem during a cast phase
    this.casting = null;

    // Bonus stats applied by passive items (initialised to neutral values).
    this.healthRegenPerS   = 0;   // HP restored per second (negative = drain)
    this.manaRegenPerS     = PLAYER.MANA_REGEN;
    this.manaCostMult      = 1;
    this.pickupRadiusBonus = 0;   // added to PLAYER.PICKUP_RADIUS
    this.xpMultiplier      = 1;   // multiplied into XP gains
    this.projectileCountBonus = 0; // extra projectiles fired by applicable skills
    this.ailmentChanceBonus = {}; // { Ignite, Shock, Chill, Freeze } as fractional bonuses
    this.selfIgnitedTimer = 0;
    this.potionChargeGainMult = 1;
    this.potionChargeGainFlat = 0;
    this.potionChargeRegenPerS = 0;
    this.potionDurationMult = 1;
    this.potionEffectMult = 1;
    this.potionMaxChargesMult = 1;
    this.potionChargesPerUseMult = 1;
    this.moveSpeedMult = 1;
    this.meleeStrikeRange = 0;
    /** Multiplicative incoming damage taken (map mods can temporarily change this). */
    this.incomingDamageMult = 1;

    // ── Defense stats (Phase 10.5) ─────────────────────────────────────────
    this.totalArmor      = 0;  // accumulated flat armor (damage reduction)
    this.totalEvasion    = 0;  // accumulated flat evasion (dodge chance)
    this.maxEnergyShield = 0;  // max ES pool
    this.energyShield    = 0;  // current ES
    this._esDamageCooldown = 0; // seconds since last ES hit; ES recharges after 2 s

    // ── Active-skill buff state (Phase 11) ────────────────────────────
    /** Blood Pact: >0 while a damage amp is active; reverted when timer expires. */
    this.damageBuff      = 1.0;
    this.damageBuffTimer = 0;
    /** Iron Bulwark: temporary shield HP that absorbs damage before ES/HP. */
    this.bulwarkShield   = 0;
    this.bulwarkDuration = 0;
    /** Arcane Surge: when > 0, active-skill cooldowns refresh at near-zero cost. */
    this.arcaneTimer     = 0;

    // ── Phase 12.2 skill stat bonuses ─────────────────────────────────────
    /** Fractional "increased" bonus applied to Spell-tagged skill damage (0 = none, 0.25 = +25%). */
    this.spellDamage         = 0;
    /** Fractional "increased" bonus applied to Attack-tagged skill damage. */
    this.attackDamage        = 0;
    /** Fractional "increased" bonus applied to AoE-tagged skill damage. */
    this.aoeDamage           = 0;
    /** Phase 5 scoped bonuses applied conditionally by tags/weapon requirements. */
    this.increasedDamageWithSword = 0;
    this.increasedDamageWithAxe = 0;
    this.increasedDamageWithBow = 0;
    this.increasedDamageWithLance = 0;
    this.increasedDamageWithWand = 0;
    this.increasedDamageWithTome = 0;
    this.increasedDamageWithAttackSkills = 0;
    this.increasedDamageWithSpellSkills = 0;
    this.increasedDamageWithBowSkills = 0;
    this.increasedAttackSpeedWithBow = 0;
    this.increasedAttackSpeedWithWand = 0;
    this.increasedAttackSpeedWithAttackSkills = 0;
    this.increasedCastSpeedWithSpellSkills = 0;
    /** Additive increased-pool for Spell castTimes. 0 = no bonus; 1.0 = +100% increased = 2x speed. */
    this.castSpeed           = 0;
    /** Additive increased-pool for Attack castTimes. 0 = no bonus; 1.0 = +100% increased = 2x speed. */
    this.attackSpeed         = 0;
    /** Countdown for ArcaneSurge's +30% castSpeed buff; reverts on expiry. */
    this._arcaneCastSpeedTimer = 0;

    // ── Elemental damage bonuses ────────────────────────────────────────────
    // Three-layer model per damage type:
    //   flat     — raw damage added to the hit before scaling  (e.g. +15 flat Blaze)
    //   increased — additive % pool summed with other increases (e.g. +20% increased Blaze → 0.20)
    //   more     — multiplicative after the increased pool     (e.g. +10% more Blaze → 0.10)
    //
    // Physical
    this.flatPhysicalDamage      = 0;
    this.increasedPhysicalDamage = 0;
    this.morePhysicalDamage      = 0;
    this.physicalPenetration     = 0;
    // Blaze (fire)
    this.flatBlazeDamage         = 0;
    this.increasedBlazeDamage    = 0;
    this.moreBlazeDamage         = 0;
    this.blazePenetration        = 0;
    // Thunder (lightning)
    this.flatThunderDamage       = 0;
    this.increasedThunderDamage  = 0;
    this.moreThunderDamage       = 0;
    this.thunderPenetration      = 0;
    // Frost (cold)
    this.flatFrostDamage         = 0;
    this.increasedFrostDamage    = 0;
    this.moreFrostDamage         = 0;
    this.frostPenetration        = 0;
    // Holy
    this.flatHolyDamage          = 0;
    this.increasedHolyDamage     = 0;
    this.moreHolyDamage          = 0;
    this.holyPenetration         = 0;
    // Unholy (chaos)
    this.flatUnholyDamage        = 0;
    this.increasedUnholyDamage   = 0;
    this.moreUnholyDamage        = 0;
    this.unholyPenetration       = 0;

    // ── Elemental resistances ───────────────────────────────────────────────
    // Fractional damage reduction per type (0.20 = 20% less damage from that element).
    // Capped at 0.75 (75%) by the damage application code.
    this.blazeResistance   = 0;
    this.thunderResistance = 0;
    this.frostResistance   = 0;
    this.holyResistance    = 0;
    this.unholyResistance  = 0;

    // ── Passive skill tree (Phase 6) ──────────────────────────────────────
    this.skillPoints    = 0;
    // Start from the character's tree gate(s). Hub is not pre-allocated;
    // the player must path inward to unlock it.
    this.allocatedNodes = new Set(characterDef?.treeStartNodes ?? []);
    this.nodeSnapshots  = new Map();
    this._activeModifierSnapshots = new Map();

    /**
     * Equipment slots — 10 total (Phase 12.5).
     * Each value is either null or { def: itemDef, passiveItem, snapshot }.
     */
    this.equipment = {
      mainhand:  null,
      offhand:   null,
      bodyarmor: null,
      helmet:    null,
      boots:     null,
      belt:      null,
      ring1:     null,
      ring2:     null,
      amulet:    null,
      gloves:    null,
    };

    /** Inventory grid — 12 columns × 6 rows (72 cells). */
    this.inventory = new InventoryGrid(12, 6);

    // Starting primary skill — from character definition, cast via Space.
    const starterSkillId = characterDef?.startingSkill ?? characterDef?.startingWeapon ?? 'MAGIC_BOLT';
    const skillFactory = AUTO_SKILL_REGISTRY[starterSkillId];
    this.autoSkills = [skillFactory ? skillFactory() : new MagicBolt()];
    this.primarySkill = this.autoSkills[0];
    if (this.primarySkill) {
      this.primarySkill.isActive = true;
      this.primarySkill._timer = this.primarySkill.cooldown;
    }

    /** Pure SkillDef instances that live outside the auto-skill list (Phase 11). */
    this.pureSkills = [];

    // Apply permanent character bonus stats (xpMultiplier, pickupRadiusFlat, etc.).
    if (characterDef?.bonusStats) {
      const b = characterDef.bonusStats;
      if (b.xpMultiplier      != null) this.xpMultiplier      *= b.xpMultiplier;
      if (b.pickupRadiusFlat  != null) this.pickupRadiusBonus += b.pickupRadiusFlat;
      if (b.healthRegenPerS   != null) this.healthRegenPerS   += b.healthRegenPerS;
      if (b.speedFlat         != null) this.speed             += b.speedFlat;
      if (b.damageMult        != null) {
        for (const w of this.autoSkills) w.damage = Math.round(w.damage * b.damageMult);
      }
    }

    // Apply free stat bonuses from the pre-allocated starting tree node(s).
    for (const nodeId of this.allocatedNodes) {
      const node = TREE_NODE_MAP[nodeId];
      if (node && node.stats && Object.keys(node.stats).length > 0) {
        const snapshot = applyStats(this, node.stats, {
          id: `passive:${nodeId}`,
          kind: node.type === 'keystone' ? 'keystone' : 'passiveTree',
          label: node.label ?? node.name ?? nodeId,
        });
        this.nodeSnapshots.set(nodeId, snapshot);
      }
    }
  }

  update(dt, input) {
    const { dx, dy } = input.getMovement();
    const terrainSpeedMult = Math.max(0.85, Math.min(1.02, this.terrainSpeedMult ?? 1));

    // Freeze movement while casting a skill
    if (!this.casting) {
      this.x += dx * this.speed * (this.moveSpeedMult ?? 1) * terrainSpeedMult * dt;
      this.y += dy * this.speed * (this.moveSpeedMult ?? 1) * terrainSpeedMult * dt;
    }

    if (this.invulnerable > 0) {
      this.invulnerable -= dt;
    }

    if (this.selfIgnitedTimer > 0) {
      this.selfIgnitedTimer = Math.max(0, this.selfIgnitedTimer - dt);
    }

    // Health regen (positive = heal; negative = drain e.g. from Void Pact keystone)
    if (this.healthRegenPerS !== 0) {
      const conflagrationBlocked =
        this.selfIgnitedTimer > 0
        && this.allocatedNodes?.has?.('bz_ks')
        && this.healthRegenPerS > 0;
      if (!conflagrationBlocked) {
        this.health = Math.max(0, Math.min(this.maxHealth, this.health + this.healthRegenPerS * dt));
      }
    }

    if (this.manaRegenPerS !== 0) {
      const prevMana = this.mana;
      this.mana = Math.max(0, Math.min(this.maxMana, this.mana + this.manaRegenPerS * dt));
      const gained = this.mana - prevMana;
      if (gained > 0) this._manaRegenCounter += gained;
    }

    // Energy shield recharge — 20% of max ES per second, delayed 2 s after last ES hit
    if (this.maxEnergyShield > 0) {
      if (this._esDamageCooldown > 0) {
        this._esDamageCooldown -= dt;
      } else {
        this.energyShield = Math.min(
          this.maxEnergyShield,
          this.energyShield + this.maxEnergyShield * 0.20 * dt,
        );
      }
    }

    // ── Active-skill buff timers (Phase 11) ──────────────────────────────
    if (this.damageBuffTimer > 0) {
      this.damageBuffTimer -= dt;
      if (this.damageBuffTimer <= 0) {
        this.damageBuffTimer = 0;
        this.damageBuff      = 1.0;
        // Revert Blood Pact temporary weapon damage boosts
        for (const w of this.autoSkills) {
          if (w._preBuffDamage !== undefined) {
            w.damage = w._preBuffDamage;
            delete w._preBuffDamage;
          }
        }
      }
    }
    if (this.bulwarkDuration > 0) {
      this.bulwarkDuration -= dt;
      if (this.bulwarkDuration <= 0) this.bulwarkShield = 0;
    }
    if (this.arcaneTimer > 0) {
      this.arcaneTimer = Math.max(0, this.arcaneTimer - dt);
    }
    if (this._arcaneCastSpeedTimer > 0) {
      this._arcaneCastSpeedTimer -= dt;
      if (this._arcaneCastSpeedTimer <= 0) {
        this._arcaneCastSpeedTimer = 0;
        this.castSpeed = Math.max(0, Math.round((this.castSpeed - 0.3) * 100) / 100);
      }
    }
  }

  takeDamage(amount) {
    if (this.invulnerable > 0) return;

    amount *= this.incomingDamageMult;

    // Evasion dodge check — chance scales with evasion/(evasion+300), cap 60%
    if (this.totalEvasion > 0) {
      const dodgeChance = Math.min(0.60, this.totalEvasion / (this.totalEvasion + 300));
      if (Math.random() < dodgeChance) return;
    }

    // Armor damage reduction — PoE-style formula, cap 75%
    let reduced = amount;
    if (this.totalArmor > 0) {
      const reduction = Math.min(0.75, this.totalArmor / (this.totalArmor + 200));
      reduced = amount * (1 - reduction);
    }

    // Iron Bulwark shield absorbs damage before Energy Shield / HP
    if (this.bulwarkShield > 0) {
      const absorbed = Math.min(this.bulwarkShield, reduced);
      this.bulwarkShield -= absorbed;
      reduced -= absorbed;
    }
    if (reduced <= 0) {
      this.invulnerable = 0.5;
      return;
    }

    // Energy shield absorbs damage before HP
    if (this.energyShield > 0) {
      const absorbed = Math.min(this.energyShield, reduced);
      this.energyShield -= absorbed;
      reduced -= absorbed;
      this._esDamageCooldown = 2.0;
    }

    this.health = Math.max(0, this.health - reduced);
    this.invulnerable = 0.5;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  addXP(amount) {
    this.xp += Math.round(amount * this.xpMultiplier);
  }

  canSpendMana(amount) {
    const cost = Math.max(0, amount ?? 0);
    return (this.mana ?? 0) >= cost;
  }

  spendMana(amount) {
    const cost = Math.max(0, amount ?? 0);
    if (!this.canSpendMana(cost)) return false;
    this.mana = Math.max(0, this.mana - cost);
    this._manaSpentCounter += cost;
    return true;
  }

  consumeManaFlowCounters() {
    const flow = {
      spent: this._manaSpentCounter ?? 0,
      regenerated: this._manaRegenCounter ?? 0,
    };
    this._manaSpentCounter = 0;
    this._manaRegenCounter = 0;
    return flow;
  }

  resetManaFlowCounters() {
    this._manaSpentCounter = 0;
    this._manaRegenCounter = 0;
  }

  /**
   * Equip an itemDef into its designated slot.
   * Items with slot='ring' may go into ring1 or ring2; the first empty one is used,
   * or ring1 is displaced if both are occupied.
   * @param {object} itemDef — generated item definition
   * @param {string} [preferredSlot] — explicit slot override (e.g. 'ring2') from UI click
   * @returns {object|null} the previously equipped itemDef (for placing on cursor), or null
   */
  equip(itemDef, preferredSlot) {
    const normalizedItem = normalizeWeaponItem(itemDef);
    const targetSlot = preferredSlot ?? this._resolveEquipSlot(normalizedItem);
    if (!this.canEquip(normalizedItem, targetSlot)) return null;

    const displaced = this.unequip(targetSlot);
    const passiveItem = new PassiveItem(normalizedItem);
    const snapshot = passiveItem.apply(this);
    this.equipment[targetSlot] = { def: normalizedItem, passiveItem, snapshot };
    return displaced;
  }

  canEquip(itemDef, preferredSlot) {
    const normalizedItem = normalizeWeaponItem(itemDef, { enforceWeaponDimensions: false });
    const targetSlot = preferredSlot ?? this._resolveEquipSlot(normalizedItem);
    return canEquipItemInSlot(normalizedItem, targetSlot, this.equipment);
  }

  /** @private Resolve actual slot key from item's slot type. */
  _resolveEquipSlot(itemDefOrSlot) {
    const itemSlot = typeof itemDefOrSlot === 'object'
      ? normalizeEquipSlotAlias(itemDefOrSlot?.slot)
      : normalizeEquipSlotAlias(itemDefOrSlot);

    if (itemSlot === 'ring') {
      if (!this.equipment.ring1) return 'ring1';
      if (!this.equipment.ring2) return 'ring2';
      return 'ring1'; // displace ring1 if both occupied
    }

    if (itemSlot === 'mainhand') {
      const normalized = typeof itemDefOrSlot === 'object'
        ? normalizeWeaponItem(itemDefOrSlot, { enforceWeaponDimensions: false })
        : null;
      if (normalized?.weaponType) {
        if (normalized.weaponType === 'tome' || normalized.weaponType === 'shield') {
          return 'offhand';
        }
        const mainhandOccupied = !!this.equipment.mainhand;
        const offhandEmpty = !this.equipment.offhand;
        if (mainhandOccupied && offhandEmpty && normalized.handedness !== 'two_hand') {
          return 'offhand';
        }
      }
    }

    return itemSlot;
  }

  /**
   * Unequip the item in `slot`, reversing its stat effects.
   * @param {string} slot
   * @returns {object|null} the unequipped itemDef, or null if slot was empty
   */
  unequip(slot) {
    const entry = this.equipment[slot];
    if (!entry) return null;
    entry.passiveItem.remove(this, entry.snapshot);
    this.equipment[slot] = null;
    return entry.def;
  }

  draw(renderer) {
    const alpha = this.invulnerable > 0 ? 0.45 : 1.0;

    // Weapon aura rings — one faint ring per equipped weapon using its color.
    // Drawn first so they appear behind the player body.
    for (let i = 0; i < this.autoSkills.length; i++) {
      const w = this.autoSkills[i];
      const ringRadius = this.radius + 6 + i * 7;
      renderer.drawStrokeCircle(this.x, this.y, ringRadius, w.config.color, 1.5, 0.35 * alpha);
    }

    // Body
    renderer.drawCircle(this.x, this.y, this.radius, '#3498db', alpha);

    // Direction dot
    renderer.drawCircle(
      this.x + this.facingX * this.radius * 0.6,
      this.y + this.facingY * this.radius * 0.6,
      4,
      '#fff',
      alpha,
    );

    renderer.drawHealthBar(this.x, this.y, this.health, this.maxHealth, 30, -24);

    // ── Cast bar (blue-green, fills left-to-right while casting) ────────
    if (this.casting) {
      const barW = 32;
      const barH = 3;
      const ratio = Math.min(1, this.casting.elapsed / this.casting.duration);
      const p = renderer.toScreen(this.x, this.y);
      const bx = p.x - barW / 2;
      const by = p.y - 19;  // just below the health bar
      const { ctx } = renderer;
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = '#3ae0d0';
      ctx.fillRect(bx, by, barW * ratio, barH);
    }
  }
}
