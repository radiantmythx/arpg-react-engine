/**
 * MetaProgression — Phase 9 persistent meta-game state.
 *
 * All data is persisted to localStorage.  All methods are static so callers
 * don't need to instantiate anything.
 *
 * Stored keys:
 *   survivor_shards       — total Chaos Shards accumulated across all runs
 *   survivor_meta_nodes   — JSON array of allocated meta-tree node ids
 *   survivor_run_history  — JSON array of last 10 RunRecord objects
 *   survivor_high_scores  — JSON object { [charId]: RunRecord[] } top 5 per char
 */

import { META_NODE_MAP } from './data/metaTree.js';

const KEYS = {
  SHARDS:      'survivor_shards',
  META_NODES:  'survivor_meta_nodes',
  HISTORY:     'survivor_run_history',
  HIGH_SCORES: 'survivor_high_scores',
};

/**
 * @typedef {object} RunRecord
 * @property {string}  characterId
 * @property {string}  characterName
 * @property {number}  elapsed          — seconds survived
 * @property {number}  kills
 * @property {number}  level
 * @property {number}  bossesDefeated   — count
 * @property {number}  shardsEarned
 * @property {string}  date             — ISO timestamp
 */

export class MetaProgression {
  // ── Chaos Shards ───────────────────────────────────────────────────────────

  static loadShards() {
    try {
      return Math.max(0, parseInt(localStorage.getItem(KEYS.SHARDS) ?? '0', 10) || 0);
    } catch { return 0; }
  }

  static saveShards(n) {
    try { localStorage.setItem(KEYS.SHARDS, String(Math.max(0, n))); } catch {}
  }

  /** Add `amount` shards to the persistent total. Returns new total. */
  static addShards(amount) {
    const next = MetaProgression.loadShards() + amount;
    MetaProgression.saveShards(next);
    return next;
  }

  // ── Meta-tree node allocation ───────────────────────────────────────────────

  static loadMetaNodes() {
    try {
      const raw = localStorage.getItem(KEYS.META_NODES);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  }

  static saveMetaNodes(nodeSet) {
    try { localStorage.setItem(KEYS.META_NODES, JSON.stringify([...nodeSet])); } catch {}
  }

  /**
   * Attempt to allocate a meta-tree node.
   * Validates: node exists, adjacent to allocated, enough shards, not already allocated.
   * Returns `{ ok: true, newTotal }` or `{ ok: false, reason }`.
   */
  static allocateMetaNode(nodeId) {
    const nodes = MetaProgression.loadMetaNodes();
    if (nodes.has(nodeId)) return { ok: false, reason: 'already_allocated' };

    const node = META_NODE_MAP[nodeId];
    if (!node) return { ok: false, reason: 'not_found' };

    // First node is always `meta_start` which costs 0 and is the root.
    const isRoot = (nodeId === 'meta_start');
    if (!isRoot) {
      const adjacent = node.connections.some((cid) => nodes.has(cid));
      if (!adjacent) return { ok: false, reason: 'not_adjacent' };
    }

    const shards = MetaProgression.loadShards();
    if (shards < node.cost) return { ok: false, reason: 'insufficient_shards' };

    MetaProgression.saveShards(shards - node.cost);
    nodes.add(nodeId);
    MetaProgression.saveMetaNodes(nodes);
    return { ok: true, newTotal: shards - node.cost };
  }

  // ── Run history ─────────────────────────────────────────────────────────────

  /** Returns up to 10 most-recent RunRecord objects, newest first. */
  static loadHistory() {
    try {
      const raw = localStorage.getItem(KEYS.HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  /** Prepend a new record; trims to last 10. */
  static addRunRecord(record) {
    const history = MetaProgression.loadHistory();
    history.unshift(record);
    if (history.length > 10) history.length = 10;
    try { localStorage.setItem(KEYS.HISTORY, JSON.stringify(history)); } catch {}
  }

  // ── High scores ─────────────────────────────────────────────────────────────

  /** Returns { [charId]: RunRecord[] } top 5 per character sorted by elapsed desc. */
  static loadHighScores() {
    try {
      const raw = localStorage.getItem(KEYS.HIGH_SCORES);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  /** Insert a record into the per-character top 5, sorted by elapsed desc. */
  static addHighScore(characterId, record) {
    const scores = MetaProgression.loadHighScores();
    const list = scores[characterId] ?? [];
    list.push(record);
    list.sort((a, b) => b.elapsed - a.elapsed);
    if (list.length > 5) list.length = 5;
    scores[characterId] = list;
    try { localStorage.setItem(KEYS.HIGH_SCORES, JSON.stringify(scores)); } catch {}
  }

  // ── Run bonuses derived from meta-tree ──────────────────────────────────────

  /**
   * Aggregate all stat bonuses granted by the given set of allocated meta nodes.
   *
   * Returns an object ready to be applied to the Player at run start:
   * {
   *   maxHealthFlat,    — flat HP added to maxHealth and current health
   *   healthRegenPerS,  — extra regen
   *   xpMultiplier,     — multiplicative XP gain
   *   damageMult,       — multiplicative weapon damage
   *   speedFlat,        — flat movement speed bonus
   *   pickupRadiusFlat, — flat pickup radius bonus
   *   shardGainMult,    — multiplier applied to Chaos Shard drops
   *   extraSkillPoints, — bonus skill points granted at run start
   *   startingRelic,    — boolean: start with a Chaos Relic item
   * }
   */
  static getRunBonuses(nodeSet) {
    const bonuses = {
      maxHealthFlat: 0, healthRegenPerS: 0, xpMultiplier: 1,
      damageMult: 1, speedFlat: 0, pickupRadiusFlat: 0,
      shardGainMult: 1, extraSkillPoints: 0, startingRelic: false,
    };

    for (const nodeId of nodeSet) {
      const node = META_NODE_MAP[nodeId];
      if (!node || !node.stats) continue;
      const s = node.stats;
      if (s.maxHealthFlat    != null) bonuses.maxHealthFlat    += s.maxHealthFlat;
      if (s.healthRegenPerS  != null) bonuses.healthRegenPerS  += s.healthRegenPerS;
      if (s.xpMultiplier     != null) bonuses.xpMultiplier     *= s.xpMultiplier;
      if (s.damageMult       != null) bonuses.damageMult       *= s.damageMult;
      if (s.speedFlat        != null) bonuses.speedFlat        += s.speedFlat;
      if (s.pickupRadiusFlat != null) bonuses.pickupRadiusFlat += s.pickupRadiusFlat;
      if (s.shardGainMult    != null) bonuses.shardGainMult    *= s.shardGainMult;
      if (s.extraSkillPoints != null) bonuses.extraSkillPoints += s.extraSkillPoints;
      if (s.startingRelic    === true) bonuses.startingRelic   = true;
    }
    return bonuses;
  }
}
