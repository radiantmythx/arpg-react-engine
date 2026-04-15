import { LEVEL_XP_TABLE } from '../config.js';
import { RighteousPyre } from '../skills/RighteousPyre.js';
import { SacredRite } from '../skills/SacredRite.js';
import { VoltaicArc } from '../skills/VoltaicArc.js';
import { WraithfireBomb } from '../skills/WraithfireBomb.js';

/**
 * UPGRADE_POOL
 * Every entry must have: id, name, description, apply(player).
 * Optional: available(player) → boolean — if provided and returns false the entry
 * is filtered out before the shuffle so it cannot appear in that level-up.
 * Examples: don't offer weapon level-ups the player has not yet unlocked;
 *           don't offer unlock cards for weapons already in the loadout.
 * To add a new upgrade: append an entry here. No other files need to change.
 */
const UPGRADE_POOL = [
  {
    id: 'dmg_up',
    name: 'Brutality',
    description: '+20% weapon damage for all owned weapons',
    apply: (player) => {
      for (const w of player.autoSkills) {
        w.damage = Math.round(w.damage * 1.2);
      }
    },
  },
  {
    id: 'speed_up',
    name: 'Phase Run',
    description: '+15% movement speed',
    apply: (player) => {
      player.speed *= 1.15;
    },
  },
  {
    id: 'hp_up',
    name: 'Iron Will',
    description: '+30 max health and restore 30 HP',
    apply: (player) => {
      player.maxHealth += 30;
      player.heal(30);
    },
  },
  {
    id: 'cooldown_down',
    name: 'Alacrity',
    description: '−15% cooldown on all owned weapons',
    apply: (player) => {
      for (const w of player.autoSkills) {
        w.cooldown *= 0.85;
      }
    },
  },
  {
    id: 'lance_level',
    name: 'Arcane Lance +',
    description: 'Upgrade Arcane Lance to the next level',
    available: (player) => player.autoSkills.some((w) => w.id === 'ARCANE_LANCE'),
    apply: (player) => {
      const lance = player.autoSkills.find((w) => w.id === 'ARCANE_LANCE');
      if (lance) lance.levelUp();
    },
  },
  {
    id: 'unlock_righteous_pyre',
    name: 'Find: Righteous Pyre',
    description: 'Add Righteous Pyre aura to your weapon loadout',
    available: (player) => !player.autoSkills.some((w) => w.id === 'RIGHTEOUS_PYRE'),
    apply: (player) => {
      const already = player.autoSkills.some((w) => w.id === 'RIGHTEOUS_PYRE');
      if (!already) player.autoSkills.push(new RighteousPyre());
    },
  },
  {
    id: 'pyre_level',
    name: 'Righteous Pyre +',
    description: 'Upgrade Righteous Pyre to the next level',
    available: (player) => player.autoSkills.some((w) => w.id === 'RIGHTEOUS_PYRE'),
    apply: (player) => {
      const w = player.autoSkills.find((w) => w.id === 'RIGHTEOUS_PYRE');
      if (w) w.levelUp();
    },
  },
  {
    id: 'unlock_sacred_rite',
    name: 'Find: Sacred Rite',
    description: 'Add Sacred Rite to your weapon loadout',
    available: (player) => !player.autoSkills.some((w) => w.id === 'SACRED_RITE'),
    apply: (player) => {
      const already = player.autoSkills.some((w) => w.id === 'SACRED_RITE');
      if (!already) player.autoSkills.push(new SacredRite());
    },
  },
  {
    id: 'rite_level',
    name: 'Sacred Rite +',
    description: 'Upgrade Sacred Rite to the next level',
    available: (player) => player.autoSkills.some((w) => w.id === 'SACRED_RITE'),
    apply: (player) => {
      const w = player.autoSkills.find((w) => w.id === 'SACRED_RITE');
      if (w) w.levelUp();
    },
  },
  {
    id: 'unlock_voltaic_arc',
    name: 'Find: Voltaic Arc',
    description: 'Add Voltaic Arc to your weapon loadout',
    available: (player) => !player.autoSkills.some((w) => w.id === 'VOLTAIC_ARC'),
    apply: (player) => {
      const already = player.autoSkills.some((w) => w.id === 'VOLTAIC_ARC');
      if (!already) player.autoSkills.push(new VoltaicArc());
    },
  },
  {
    id: 'arc_level',
    name: 'Voltaic Arc +',
    description: 'Upgrade Voltaic Arc to the next level',
    available: (player) => player.autoSkills.some((w) => w.id === 'VOLTAIC_ARC'),
    apply: (player) => {
      const w = player.autoSkills.find((w) => w.id === 'VOLTAIC_ARC');
      if (w) w.levelUp();
    },
  },
  {
    id: 'unlock_wraithfire_bomb',
    name: 'Find: Wraithfire Bomb',
    description: 'Add Wraithfire Bomb (auto) to your weapon loadout',
    available: (player) => !player.autoSkills.some((w) => w.id === 'WRAITHFIRE_BOMB'),
    apply: (player) => {
      const already = player.autoSkills.some((w) => w.id === 'WRAITHFIRE_BOMB');
      if (!already) player.autoSkills.push(new WraithfireBomb());
    },
  },

  // ── Phase 10 weapon upgrades ─────────────────────────────────────────────
  {
    id: 'lightning_level',
    name: 'Chain Lightning +',
    description: 'Upgrade Chain Lightning to the next level',
    available: (player) => player.autoSkills.some((w) => w.id === 'CHAIN_LIGHTNING'),
    apply: (player) => {
      const w = player.autoSkills.find((w) => w.id === 'CHAIN_LIGHTNING');
      if (w) w.levelUp();
    },
  },
  {
    id: 'bonespear_level',
    name: 'Bone Spear +',
    description: 'Upgrade Bone Spear to the next level',
    available: (player) => player.autoSkills.some((w) => w.id === 'BONE_SPEAR'),
    apply: (player) => {
      const w = player.autoSkills.find((w) => w.id === 'BONE_SPEAR');
      if (w) w.levelUp();
    },
  },
  {
    id: 'voidshard_level',
    name: 'Void Shard Swarm +',
    description: 'Upgrade Void Shard Swarm to the next level',
    available: (player) => player.autoSkills.some((w) => w.id === 'VOID_SHARD_SWARM'),
    apply: (player) => {
      const w = player.autoSkills.find((w) => w.id === 'VOID_SHARD_SWARM');
      if (w) w.levelUp();
    },
  },
  {
    id: 'wraithfire_level',
    name: 'Wraithfire Bomb +',
    description: 'Upgrade Wraithfire Bomb to the next level',
    available: (player) => player.autoSkills.some((w) => w.id === 'WRAITHFIRE_BOMB'),
    apply: (player) => {
      const w = player.autoSkills.find((w) => w.id === 'WRAITHFIRE_BOMB');
      if (w) w.levelUp();
    },
  },

  // ── Phase 11 active-skill upgrades ───────────────────────────────────────
  {
    id: 'blade_level',
    name: 'Phantom Blade +',
    description: 'Upgrade Phantom Blade to the next level',
    available: (player) => player.autoSkills.some((w) => w.id === 'PHANTOM_BLADE'),
    apply: (player) => {
      const blade = player.autoSkills.find((w) => w.id === 'PHANTOM_BLADE');
      if (blade) blade.levelUp();
    },
  },
  {
    id: 'cleave_level',
    name: 'Tectonic Cleave +',
    description: 'Upgrade Tectonic Cleave to the next level',
    available: (player) => player.autoSkills.some((w) => w.id === 'TECTONIC_CLEAVE'),
    apply: (player) => {
      const w = player.autoSkills.find((w) => w.id === 'TECTONIC_CLEAVE');
      if (w) w.levelUp();
    },
  },
];

/**
 * ExperienceSystem
 * Handles XP collection, checks level-up thresholds, and drives the upgrade selection flow.
 */
export class ExperienceSystem {
  /**
   * @param {import('../GameEngine.js').GameEngine} engine
   * @param {() => void} onLevelUp - React callback that opens the passive tree
   */
  constructor(engine, onLevelUp) {
    this.engine = engine;
    this.onLevelUp = onLevelUp;
  }

  /** Called by CollisionSystem when the player touches an XP gem. */
  collect(amount) {
    const { player } = this.engine;
    player.addXP(amount);

    const maxLevel = LEVEL_XP_TABLE.length; // cap at table size
    if (player.level >= maxLevel) return;

    const threshold = LEVEL_XP_TABLE[player.level];
    if (player.xp >= threshold) {
      player.level++;
      player.xp = 0;
      player.xpToNext = LEVEL_XP_TABLE[Math.min(player.level, maxLevel - 1)];
      this._triggerLevelUp();
    }
  }

  _triggerLevelUp() {
    // Grant passive points per level: 3 base + 2 per 10 levels (lv12→5, lv36→9).
    const lvl = this.engine.player.level;
    this.engine.player.skillPoints += 3 + Math.floor(lvl / 10) * 2;
    // Log the level-up event for the death recap timeline.
    this.engine.runEventLog.push({ type: 'level', time: this.engine.elapsed, level: this.engine.player.level });
    // Flush HUD immediately so skillPoints is > 0 when the tree screen opens.
    this.engine._flushHudUpdate();
    this.engine.pause();

    this.onLevelUp(); // open the passive tree screen
  }

  /**
   * Persist character progress at a safe checkpoint (e.g., map clear).
   * C2 delegates to GameEngine.checkpoint(), which serializes player state.
   */
  checkpoint() {
    this.engine?.checkpoint?.();
  }

  /** Fisher-Yates shuffle of the available pool then take the first `count` items. */
  _pickUpgrades(count) {
    const { player } = this.engine;
    // Filter to only entries that are currently relevant for this player's loadout.
    const pool = UPGRADE_POOL.filter((entry) => !entry.available || entry.available(player));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }
}
