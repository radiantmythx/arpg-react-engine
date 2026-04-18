/**
 * CharacterSave — C1 persistent character storage.
 *
 * All data is stored in localStorage.  All methods are static.
 *
 * localStorage keys:
 *   arpg_char_index          — JSON array of CharacterSummary objects (fast list view)
 *   arpg_char_<id>           — full JSON character data blob
 *
 * Save format version history:
 *   (unversioned) — equipment used keys 'weapon' and 'armor' for mainhand/bodyarmor.
 *                   Missing energy shield, new slots (gloves, belt), activeSkills.
 *   1             — equipment keys normalised to 'mainhand'/'bodyarmor'; all slots present;
 *                   energyShield, maxEnergyShield, and activeSkills fields added.
 *   2             — saveVersion stamp introduced; no data shape change.
 */
export const CURRENT_SAVE_VERSION = 2;

const NAMESPACE  = 'arpg_char_';
const INDEX_KEY  = 'arpg_char_index';

function makeStarterUid(classId = 'starter') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `starter_${classId}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export function createStarterWeaponForClass(classId = 'sage') {
  const normalizedClassId = String(classId || 'sage').toLowerCase();

  if (normalizedClassId === 'rogue') {
    return {
      uid: makeStarterUid('rogue'),
      id: 'starter_rogue_bow',
      name: 'Rogue Training Bow',
      description: 'A basic bow issued to new rogues.',
      rarity: 'normal',
      slot: 'mainhand',
      weaponType: 'bow',
      gridW: 2,
      gridH: 3,
      color: '#9e9e9e',
      basePrice: 1,
      stats: { damageMult: 1.0 },
      baseStats: { damageMult: 1.0 },
      affixes: [],
      explicitAffixes: [],
      implicitAffixes: [],
    };
  }

  if (normalizedClassId === 'warrior') {
    return {
      uid: makeStarterUid('warrior'),
      id: 'starter_warrior_sword',
      name: 'Warrior Training Sword',
      description: 'A basic sword issued to new warriors.',
      rarity: 'normal',
      slot: 'mainhand',
      weaponType: 'sword',
      gridW: 1,
      gridH: 3,
      color: '#9e9e9e',
      basePrice: 1,
      stats: { damageMult: 1.0 },
      baseStats: { damageMult: 1.0 },
      affixes: [],
      explicitAffixes: [],
      implicitAffixes: [],
    };
  }

  // Sage is the class id for the mage archetype.
  return {
    uid: makeStarterUid('sage'),
    id: normalizedClassId === 'mage' ? 'starter_mage_wand' : 'starter_sage_wand',
    name: 'Apprentice Wand',
    description: 'A basic wand issued to new mages.',
    rarity: 'normal',
    slot: 'mainhand',
    weaponType: 'wand',
    gridW: 1,
    gridH: 2,
    color: '#9e9e9e',
    basePrice: 1,
    stats: { damageMult: 1.0 },
    baseStats: { damageMult: 1.0 },
    affixes: [],
    explicitAffixes: [],
    implicitAffixes: [],
  };
}

// ── Internal index helpers ────────────────────────────────────────────────────

/**
 * Migrate a raw character data blob from any legacy format to the current
 * format. Safe to call on already-current data (idempotent).
 *
 * Returns { data, migrated } where `migrated` is true if any changes were made.
 *
 * @param {object} raw - Parsed save blob from localStorage.
 * @returns {{ data: object, migrated: boolean }}
 */
export function migrateSave(raw) {
  if (!raw || typeof raw !== 'object') return { data: raw, migrated: false };

  let migrated = false;
  const data = { ...raw };

  // ── Equipment slot key renames ──────────────────────────────────────────────
  // Pre-v1: 'weapon' → 'mainhand', 'armor' → 'bodyarmor'
  if (data.equipment && typeof data.equipment === 'object') {
    const eq = { ...data.equipment };

    if ('weapon' in eq && !('mainhand' in eq)) {
      eq.mainhand = eq.weapon;
      delete eq.weapon;
      migrated = true;
    }
    if ('armor' in eq && !('bodyarmor' in eq)) {
      eq.bodyarmor = eq.armor;
      delete eq.armor;
      migrated = true;
    }

    // Ensure all current equipment slots are present (default to null).
    const EXPECTED_SLOTS = [
      'mainhand', 'offhand', 'bodyarmor', 'helmet',
      'boots', 'belt', 'ring1', 'ring2', 'amulet', 'gloves',
    ];
    for (const slot of EXPECTED_SLOTS) {
      if (!(slot in eq)) {
        eq[slot] = null;
        migrated = true;
      }
    }

    data.equipment = eq;
  }

  // ── Energy shield fields ────────────────────────────────────────────────────
  if (!('energyShield' in data)) { data.energyShield = 0; migrated = true; }
  if (!('maxEnergyShield' in data)) { data.maxEnergyShield = 0; migrated = true; }

  // ── Active skills ──────────────────────────────────────────────────────────
  if (!Array.isArray(data.activeSkills)) {
    data.activeSkills = [null, null, null];
    migrated = true;
  }

  // ── Gold ──────────────────────────────────────────────────────────────────
  if (typeof data.gold !== 'number') { data.gold = 0; migrated = true; }

  // ── Save version stamp ─────────────────────────────────────────────────────
  if (!data.saveVersion || data.saveVersion < CURRENT_SAVE_VERSION) {
    data.saveVersion = CURRENT_SAVE_VERSION;
    migrated = true;
  }

  return { data, migrated };
}

function getIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function setIndex(index) {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(index)); } catch {}
}

// ── Public API ────────────────────────────────────────────────────────────────

export class CharacterSave {
  /**
   * Persist a full character data object.
   * Also updates the lightweight index entry used by list().
   * @param {string} characterId
   * @param {object} data  — full character data (matches schema below)
   */
  static save(characterId, data) {
    try {
      const now = new Date().toISOString();
      const blob = JSON.stringify({ ...data, lastPlayed: now, saveVersion: CURRENT_SAVE_VERSION });
      localStorage.setItem(NAMESPACE + characterId, blob);

      // Upsert index entry
      const index = getIndex();
      const idx   = index.findIndex((e) => e.id === characterId);
      const summary = {
        id:         characterId,
        name:       data.name       ?? 'Exile',
        class:      data.class      ?? 'sage',
        level:      data.level      ?? 1,
        created:    data.created    ?? now,
        lastPlayed: now,
      };
      if (idx >= 0) index[idx] = summary;
      else          index.push(summary);
      setIndex(index);
    } catch (e) {
      console.error('[CharacterSave] save failed:', e);
    }
  }

  /**
   * Load a full character data object, automatically migrating legacy saves
   * to the current schema. If migration occurs the updated data is written
   * back to localStorage immediately.
   * @param {string} characterId
   * @returns {object|null}
   */
  static load(characterId) {
    try {
      const raw = localStorage.getItem(NAMESPACE + characterId);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const { data, migrated } = migrateSave(parsed);
      if (migrated) {
        // Persist the migrated data so subsequent loads are already current.
        try {
          localStorage.setItem(NAMESPACE + characterId, JSON.stringify(data));
        } catch { /* storage full — non-fatal */ }
      }
      return data;
    } catch { return null; }
  }

  /**
   * Return lightweight summaries of all saved characters,
   * sorted by lastPlayed descending (most recent first).
   * @returns {Array<{ id, name, class, level, created, lastPlayed }>}
   */
  static list() {
    const index = getIndex();
    return [...index].sort(
      (a, b) => new Date(b.lastPlayed ?? 0) - new Date(a.lastPlayed ?? 0),
    );
  }

  /**
   * Delete a character and remove it from the index.
   * @param {string} characterId
   */
  static delete(characterId) {
    try {
      localStorage.removeItem(NAMESPACE + characterId);
      setIndex(getIndex().filter((e) => e.id !== characterId));
    } catch {}
  }

  /**
   * True if a character with this id exists in localStorage.
   * @param {string} characterId
   * @returns {boolean}
   */
  static exists(characterId) {
    try { return localStorage.getItem(NAMESPACE + characterId) !== null; }
    catch { return false; }
  }

  /**
   * Build the initial save data for a brand-new character.
   *
   * @param {string} id         — crypto.randomUUID() generated by caller
   * @param {string} name       — player-entered name
   * @param {import('./data/characters.js').CharacterDef} charDef — from CHARACTERS
   * @returns {object}          — full character data blob
   */
  static createInitial(id, name, charDef) {
    const now = new Date().toISOString();
    return {
      id,
      name,
      class:      charDef.id,
      created:    now,
      lastPlayed: now,

      // ── Combat stats ──────────────────────────────────────────────────────
      level:          1,
      xp:             0,
      health:         charDef.baseStats?.maxHealth ?? 100,
      maxHealth:      charDef.baseStats?.maxHealth ?? 100,
      mana:           charDef.baseStats?.maxMana ?? 100,
      maxMana:        charDef.baseStats?.maxMana ?? 100,
      energyShield:   0,
      maxEnergyShield: 0,
      gold: 0,

      // ── Systems ───────────────────────────────────────────────────────────
      // passiveTree.allocated mirrors the pre-allocated tree start nodes.
      passiveTree: {
        allocated: Array.isArray(charDef.treeStartNodes)
          ? [...charDef.treeStartNodes]
          : [],
      },
      metaTree:    { allocated: [] },

      // Inventory is empty; grid matches InventoryGrid default (12×6).
      inventory: { cols: 12, rows: 6, items: [] },

      // Starter mainhand weapon is seeded so class basic attacks are usable immediately.
      equipment: {
        mainhand:  createStarterWeaponForClass(charDef.id),
        offhand:   null,
        bodyarmor: null, helmet:    null,
        boots:     null, belt:      null,
        ring1:     null, ring2:     null,
        amulet:    null, gloves:    null,
      },

      // Three active skill slots — empty to start.
      activeSkills: [null, null, null],

      // Starter auto-fire skill from the character definition.
      autoSkills: [charDef.startingSkill ?? charDef.startingWeapon ?? 'MAGIC_BOLT'],

      // ── Map progress ──────────────────────────────────────────────────────
      actsCleared: [],
      actsClearedAt: {},
      mapsCleared: 0,
      bossesKilled: [],

      // Per-character meta currency (account-wide stash is separate).
      chaosShards: 0,

      // Save format version — used by migrateSave() for forward compatibility.
      saveVersion: CURRENT_SAVE_VERSION,
    };
  }
}
