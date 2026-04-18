// All game constants and balance data live here.
// Never scatter magic numbers throughout other files.

export const GAME_STATES = {
  MENU: 'MENU',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  LEVEL_UP: 'LEVEL_UP',
  GAME_OVER: 'GAME_OVER',
};

export const PLAYER = {
  SPEED: 180,        // px/s
  MAX_HEALTH: 100,
  MAX_MANA: 100,
  MANA_REGEN: 3,
  RADIUS: 14,
  PICKUP_RADIUS: 50, // distance at which XP gems begin magnetizing
};

export const ENEMY_AI = {
  baseAggroRadius: 420,
  championAggroBonus: 120,
  propagationRadius: 300,
  suspiciousDuration: 0.25,
  repathInterval: 0.3,
  leashDistance: 1200,
};

/**
 * Default skill loadout for enemies without explicit skills.
 * Basic melee strike that rolls 5–10 physical damage on a 1.5 s cooldown.
 * `range` = reach beyond the sum of attacker + target radii.
 */
export const DEFAULT_ENEMY_SKILLS = [
  {
    id: 'enemy_melee',
    name: 'Melee Strike',
    damage: { min: 5, max: 10 },
    cooldown: 1.5,
    castTime: 0.15,
    range: 10,
    tags: ['Attack', 'Melee', 'Physical'],
  },
];

export const WEAPONS = {
  // ── Starter auto-fire skills (one per class) ─────────────────────────────
  MAGIC_BOLT: {
    id: 'MAGIC_BOLT',
    name: 'Magic Bolt',
    description: 'Launches a bolt of arcane energy at the nearest enemy.',
    cooldown: 0,
    castTime: 0.50,   // attack speed/cast speed reduce this
    manaCost: 5,
    damage: 14,
    projectileSpeed: 420,
    projectileRadius: 7,
    projectileLifetime: 1.4,
    color: '#a29bfe',   // soft violet
  },
  SWIFT_ARROW: {
    id: 'SWIFT_ARROW',
    name: 'Swift Arrow',
    description: 'Looses a quick arrow toward the nearest enemy.',
    requiresWeaponType: ['bow'],
    requirementHint: 'Equip a Bow to use Swift Arrow.',
    cooldown: 0,
    castTime: 0.30,   // reduced by attack speed
    manaCost: 4,
    damage: 10,
    projectileSpeed: 560,
    projectileRadius: 4,
    projectileLifetime: 1.2,
    color: '#55efc4',   // teal green
  },
  FROST_ARROW: {
    id: 'FROST_ARROW',
    name: 'Frost Arrow',
    description: 'Looses a chilled arrow that deals light Frost damage.',
    requiresWeaponType: ['bow'],
    requirementHint: 'Equip a Bow to use Frost Arrow.',
    cooldown: 0,
    castTime: 0.65,   // reduced by attack speed
    manaCost: 4,
    damage: 9,
    projectileSpeed: 540,
    projectileRadius: 4,
    projectileLifetime: 1.2,
    color: '#7fd6ff',
  },
  MELEE_STRIKE: {
    id: 'MELEE_STRIKE',
    name: 'Melee Strike',
    description: 'Swings a weapon in a wide arc, striking all nearby enemies.',
    cooldown: 0,
    castTime: 0.45,   // reduced by attack speed
    manaCost: 6,
    damage: 25,
    strikeRadius: 70,
    color: '#e17055',   // warm orange-red
  },
  FIRE_STRIKE: {
    id: 'FIRE_STRIKE',
    name: 'Fire Strike',
    description: 'A melee slash that deals mostly physical damage with a small blaze hit.',
    requiresWeaponType: ['sword', 'axe', 'lance', 'staff'],
    requirementHint: 'Equip a melee weapon (Sword, Axe, Lance, or Staff) to use Fire Strike.',
    cooldown: 0,
    castTime: 0.45,   // reduced by attack speed
    manaCost: 6,
    damage: 24,
    strikeRadius: 70,
    color: '#ff8b5c',
  },

  // ── Original weapons (all remain available as hotbar active skills) ───────
  ARCANE_LANCE: {
    id: 'ARCANE_LANCE',
    name: 'Arcane Lance',
    description: 'Fires a lance of arcane energy at the nearest enemy.',
    cooldown: 0,
    castTime: 0.65,      // reduced by cast speed
    manaCost: 10,
    damage: 20,
    projectileSpeed: 400, // px/s
    projectileRadius: 6,
    projectileLifetime: 1.5, // seconds
    color: '#f1c40f',
  },
  PHANTOM_BLADE: {
    id: 'PHANTOM_BLADE',
    name: 'Phantom Blade',
    description: 'Hurls a spectral blade in the direction of movement.',
    cooldown: 0,
    castTime: 0.55,   // reduced by attack speed
    manaCost: 9,
    damage: 15,
    projectileSpeed: 500,
    projectileRadius: 5,
    projectileLifetime: 0.6,
    color: '#95a5a6',
  },
  RIGHTEOUS_PYRE: {
    id: 'RIGHTEOUS_PYRE',
    name: 'Righteous Pyre',
    description: 'Ignites a holy aura that continuously burns nearby enemies.',
    cooldown: 0.5,       // pulse interval — aura does NOT freeze player
    castTime: 0,         // intentionally zero: constant-pulse auras skip the cast phase
    manaCost: 7,
    damage: 5,
    auraRadius: 80,
    color: '#f39c12',
  },
  TECTONIC_CLEAVE: {
    id: 'TECTONIC_CLEAVE',
    name: 'Tectonic Cleave',
    description: 'Hurls an earth-rending projectile in a gravitied arc, piercing all enemies in its path.',
    cooldown: 1.5,       // recharge after cast; strong skill keeps cooldown
    castTime: 1.20,      // heavy wind-up; reduced by cast speed
    manaCost: 18,
    damage: 40,
    projectileSpeed: 280,
    projectileRadius: 11,
    projectileLifetime: 2.0,
    gravity: 200, // world-Y acceleration in px/s²
    color: '#8e44ad',
  },
  SACRED_RITE: {
    id: 'SACRED_RITE',
    name: 'Sacred Rite',
    description: 'Hurls a consecrated flask that detonates into a lingering damage zone for 3 seconds.',
    cooldown: 2.5,       // recharge; zone skill keeps cooldown
    castTime: 0.70,      // flask lob wind-up; reduced by cast speed
    manaCost: 20,
    damage: 12,
    flaskSpeed: 350,
    flaskLifetime: 1.0,
    flaskRadius: 5,
    zoneRadius: 65,
    zoneDuration: 3.0,
    zonePulseRate: 0.5,
    color: '#2ecc71',
  },
  VOLTAIC_ARC: {
    id: 'VOLTAIC_ARC',
    name: 'Voltaic Arc',
    description: 'Discharges a ring of electricity that radiates outward, zapping every enemy it crosses.',
    cooldown: 1.5,       // recharge; ring skill keeps cooldown
    castTime: 0.60,      // charge-up before discharge; reduced by cast speed
    manaCost: 14,
    damage: 25,
    expandSpeed: 320, // px/s ring expansion
    maxRadius: 200,
    color: '#00bcd4',
  },

  // ── Phase 10 weapons ──────────────────────────────────────────────────────
  CHAIN_LIGHTNING: {
    id: 'CHAIN_LIGHTNING',
    name: 'Chain Lightning',
    description: 'Fires a bolt that arcs between up to 4 nearby enemies, dealing fading damage per hop.',
    cooldown: 0,
    castTime: 0.55,   // charge-up; reduced by cast speed
    manaCost: 12,
    damage: 22,
    projectileSpeed: 500,
    projectileRadius: 7,
    projectileLifetime: 1.2,
    chainRadius: 160,  // px — max hop distance
    maxChains: 3,      // additional targets per bolt (not counting the primary)
    chainDecay: 0.25,  // % damage reduction per hop
    color: '#f9ca24',
  },
  BONE_SPEAR: {
    id: 'BONE_SPEAR',
    name: 'Bone Spear',
    description: 'Hurls a massive bone shard that pierces all enemies in its path.',
    cooldown: 0.5,       // short recharge; heavy spell keeps small cooldown
    castTime: 1.00,      // long wind-up; reduced by cast speed
    manaCost: 16,
    damage: 55,
    projectileSpeed: 340,
    projectileRadius: 12,
    projectileLifetime: 2.2,
    color: '#dfe6e9',  // off-white bone
  },
  VOID_SHARD_SWARM: {
    id: 'VOID_SHARD_SWARM',
    name: 'Void Shard Swarm',
    description: 'Launches 3 homing shards that spiral outward before tracking the nearest enemy.',
    cooldown: 0,
    castTime: 0.70,   // conjure time; reduced by cast speed
    manaCost: 13,
    damage: 16,
    projectileSpeed: 280,
    projectileRadius: 5,
    projectileLifetime: 2.2,
    color: '#a29bfe',  // violet
  },
  WRAITHFIRE_BOMB: {
    id: 'WRAITHFIRE_BOMB',
    name: 'Wraithfire Bomb',
    description: 'Lobs an exploding bomb that leaves a burning zone dealing damage over time.',
    cooldown: 2.0,       // recharge; zone skill keeps cooldown
    castTime: 0.70,      // lob wind-up; reduced by cast speed
    manaCost: 17,
    damage: 15,
    bombLifetime: 1.0,  // seconds to reach target
    zoneRadius: 70,
    zoneDuration: 3.0,
    zonePulseRate: 0.50,
    color: '#00b894',  // ghostly green
  },
};

// Scheduled waves: list of { time (seconds), type (enemy id), count }
// Played in order once elapsed time passes the timestamp.
export const WAVE_SCHEDULE = [
  { time: 0,   type: 'RHOA',              count: 3 },
  { time: 10,  type: 'RHOA',              count: 5 },
  { time: 20,  type: 'UNDYING_THRALL',    count: 3 },
  { time: 30,  type: 'RHOA',              count: 8 },
  { time: 40,  type: 'RATTLING_REMNANT',  count: 5 },
  { time: 60,  type: 'UNDYING_THRALL',    count: 6 },
  { time: 90,  type: 'RHOA',              count: 15 },
  { time: 120, type: 'RATTLING_REMNANT',  count: 10 },
  { time: 150, type: 'UNDYING_THRALL',    count: 12 },
  { time: 180, type: 'RHOA',              count: 25 },
  // Phase 10 escalation
  { time: 210, type: 'SHRIEKING_BANSHEE', count: 6  },
  { time: 240, type: 'PLAGUE_CRAWLER',    count: 4  },
  { time: 270, type: 'VOID_STALKER',      count: 8  },
  { time: 300, type: 'SHRIEKING_BANSHEE', count: 10 },
  { time: 330, type: 'PLAGUE_CRAWLER',    count: 6  },
  { time: 360, type: 'SHADE',             count: 12 },
  { time: 390, type: 'IRON_COLOSSUS',     count: 2  },
  { time: 420, type: 'VOID_STALKER',      count: 15 },
  { time: 450, type: 'SHADE',             count: 18 },
  { time: 480, type: 'IRON_COLOSSUS',     count: 3  },
  { time: 510, type: 'PLAGUE_CRAWLER',    count: 10 },
  { time: 540, type: 'SHRIEKING_BANSHEE', count: 20 },
  { time: 600, type: 'IRON_COLOSSUS',     count: 5  },
  { time: 630, type: 'VOID_STALKER',      count: 25 },
  { time: 660, type: 'SHADE',             count: 25 },
];

export const SPAWN_RADIUS = 600;  // enemies spawn at this distance from player
export const DESPAWN_RADIUS = 900; // enemies beyond this are removed

// XP required to reach each level (index = target level, 0-indexed so index 1 = level 2)
// Player starts at level 1 and needs LEVEL_XP_TABLE[1] XP to reach level 2, etc.
export const LEVEL_XP_TABLE = [
  0,   // level 1 — placeholder, never used
  10,  // level 2
  20,  // level 3
  35,  // level 4
  55,  // level 5
  80,  // level 6
  110, // level 7
  150, // level 8
  200, // level 9
  260, // level 10
  330, // level 11
  410, // level 12
  500, // level 13
  600, // level 14
  710, // level 15
  830, // level 16
  960, // level 17
  1100, // level 18
  1250, // level 19
  1410, // level 20
  1580, // level 21
  1760, // level 22
  1950, // level 23
  2150, // level 24
  2360, // level 25
  2580, // level 26
  2810, // level 27
  3050, // level 28
  3300, // level 29
  3560, // level 30
  3830, // level 31
  4110, // level 32
];

export const TILE_SIZE = 64; // background grid tile size in px

// --- Phase 8: Map themes ---
/** Four distinct visual themes; a random one is chosen per run, then it advances at 5 min. */
export const MAP_THEMES = [
  { name: 'Twilight Ruins',    bg: '#1a1a2e', grid: '#16213e' },
  { name: 'Bloodstained Moor', bg: '#1e0a0a', grid: '#2d1010' },
  { name: 'Arcane Sanctum',    bg: '#080b1e', grid: '#0e1135' },
  { name: 'Fellwood',          bg: '#060e06', grid: '#0a160a' },
];

// --- Phase 8: Boss definitions ---
export const BOSS_DEFS = {
  HOLLOW_SOVEREIGN: {
    id: 'HOLLOW_SOVEREIGN',
    name: 'The Hollow Sovereign',
    health: 900,
    radius: 36,
    speed: 48,
    damage: 25,
    xpValue: 120,
    color: '#9b59b6',
    attackType: 'ring',
    attackCooldown: 3.2,
    attackDamage: 18,
    resistances: { unholy: 0.20, frost: 0.15 },           // hollow undead — void/cold-touched
  },
  UNDYING_TIDE: {
    id: 'UNDYING_TIDE',
    name: 'The Undying Tide',
    health: 1800,
    radius: 44,
    speed: 36,
    damage: 30,
    xpValue: 250,
    color: '#27ae60',
    attackType: 'scatter',
    attackCooldown: 3.8,
    attackDamage: 22,
    resistances: { frost: 0.25, unholy: 0.20, physical: 0.15 }, // mass of undead — cold/necrotic fortified
  },
  WRAECLASTS_CHOSEN: {
    id: 'WRAECLASTS_CHOSEN',
    name: "Wraeclast's Chosen",
    health: 3200,
    radius: 50,
    speed: 28,
    damage: 38,
    xpValue: 500,
    color: '#e74c3c',
    attackType: 'combo',
    attackCooldown: 2.8,
    attackDamage: 28,
    resistances: { physical: 0.20, blaze: 0.15, holy: -0.15 }, // warrior champion; weak to holy
  },

  // ── Phase 10 bosses ──────────────────────────────────────────────────────
  THE_STARVELING: {
    id: 'THE_STARVELING',
    name: 'The Starveling',
    health: 5200,
    radius: 46,
    speed: 60,         // faster than previous bosses — ravenous dash
    damage: 42,
    xpValue: 750,
    color: '#fdcb6e',  // jaundiced yellow
    attackType: 'scatter',
    attackCooldown: 2.4,
    attackDamage: 30,
    resistances: { blaze: 0.20, unholy: 0.15, frost: -0.20 }, // feverish ravenous beast; weak to frost
  },
  ABYSSAL_ENGINE: {
    id: 'ABYSSAL_ENGINE',
    name: 'The Abyssal Engine',
    health: 8000,
    radius: 58,
    speed: 22,
    damage: 50,
    xpValue: 1200,
    color: '#636e72',  // dark machine grey
    attackType: 'combo',
    attackCooldown: 2.0,
    attackDamage: 38,
    resistances: { physical: 0.35, thunder: 0.25, blaze: -0.20 }, // armored machine; weak to fire
  },
};

/** Boss spawn times (seconds elapsed). Must be sorted ascending. */
export const BOSS_SCHEDULE = [
  { time: 180, id: 'HOLLOW_SOVEREIGN' },
  { time: 300, id: 'UNDYING_TIDE' },
  { time: 420, id: 'WRAECLASTS_CHOSEN' },
  { time: 540, id: 'THE_STARVELING' },
  { time: 660, id: 'ABYSSAL_ENGINE' },
];
