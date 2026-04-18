/**
 * metaTree.js — Phase 9 Meta-Passive Tree
 *
 * 21 nodes in a hub-and-4-spokes layout. Nodes cost Chaos Shards instead of
 * skill points. Stats here are PERMANENT bonuses applied at the start of every run.
 *
 * SVG coordinate space: 0 0 900 600, origin top-left.
 * Center hub at (450, 300).
 *
 * Spokes:
 *   Endurance  — upper-right  (max HP / regen)
 *   Scholar    — upper-left   (XP gain / starting skill point)
 *   Veteran    — lower-right  (weapon damage / speed)
 *   Fortune    — lower-left   (Chaos Shard gain / pickup radius)
 *
 * Keystones at top and bottom centers:
 *   stash_point — "Ascendant Start"  — begin each run with +1 skill point
 *   stash_relic — "League Relic"     — begin each run with a Chaos Relic in inventory
 *
 * Stats key legend (same namespace as passive tree / applyStats):
 *   maxHealthFlat, healthRegenPerS, xpMultiplier, damageMult,
 *   speedFlat, pickupRadiusFlat, shardGainMult, extraSkillPoints, startingRelic
 */

export const META_TREE_NODES = [

  // ── Hub ──────────────────────────────────────────────────────────────────

  {
    id: 'meta_start',
    label: "Exile's Legacy",
    description: "Every run leaves its mark. The beginning of your meta-journey.",
    type: 'minor',
    cost: 0,
    position: { x: 450, y: 300 },
    connections: ['me1', 'ms1', 'mv1', 'mf1'],
    stats: {},
  },

  // ── Endurance — upper-right ───────────────────────────────────────────────

  {
    id: 'me1',
    label: '+12 Max Life',
    description: '+12 to maximum life at the start of every run.',
    type: 'minor',
    cost: 3,
    position: { x: 570, y: 243 },
    connections: ['meta_start', 'me2'],
    stats: { maxHealthFlat: 12 },
  },
  {
    id: 'me2',
    label: '+20 Max Life',
    description: '+20 to maximum life.',
    type: 'minor',
    cost: 5,
    position: { x: 668, y: 200 },
    connections: ['me1', 'me3'],
    stats: { maxHealthFlat: 20 },
  },
  {
    id: 'me3',
    label: '+30 Max Life',
    description: '+30 to maximum life.',
    type: 'minor',
    cost: 8,
    position: { x: 756, y: 170 },
    connections: ['me2', 'me_notable'],
    stats: { maxHealthFlat: 30 },
  },
  {
    id: 'me_notable',
    label: 'Iron Constitution',
    description: '+50 maximum life and +1.5 life regenerated per second.',
    type: 'notable',
    cost: 14,
    position: { x: 838, y: 150 },
    connections: ['me3', 'stash_point'],
    stats: { maxHealthFlat: 50, healthRegenPerS: 1.5 },
  },

  // ── Scholar — upper-left ──────────────────────────────────────────────────

  {
    id: 'ms1',
    label: '+6% Experience',
    description: '+6% experience gained in every run.',
    type: 'minor',
    cost: 3,
    position: { x: 330, y: 243 },
    connections: ['meta_start', 'ms2'],
    stats: { xpMultiplier: 1.06 },
  },
  {
    id: 'ms2',
    label: '+10% Experience',
    description: '+10% experience gained.',
    type: 'minor',
    cost: 5,
    position: { x: 232, y: 200 },
    connections: ['ms1', 'ms3'],
    stats: { xpMultiplier: 1.10 },
  },
  {
    id: 'ms3',
    label: '+15% Experience',
    description: '+15% experience gained.',
    type: 'minor',
    cost: 8,
    position: { x: 148, y: 172 },
    connections: ['ms2', 'ms_notable'],
    stats: { xpMultiplier: 1.15 },
  },
  {
    id: 'ms_notable',
    label: 'Ancient Wisdom',
    description: '+20% experience gained. Begin each run with 1 bonus skill point.',
    type: 'notable',
    cost: 14,
    position: { x: 68, y: 152 },
    connections: ['ms3', 'stash_point'],
    stats: { xpMultiplier: 1.20, extraSkillPoints: 1 },
  },

  // ── Keystone: top ─────────────────────────────────────────────────────────

  {
    id: 'stash_point',
    label: 'Ascendant Start',
    description: 'Begin each run with an additional +1 skill point to spend in the passive tree.',
    type: 'keystone',
    cost: 22,
    position: { x: 450, y: 80 },
    connections: ['me_notable', 'ms_notable'],
    stats: { extraSkillPoints: 1 },
  },

  // ── Veteran — lower-right ─────────────────────────────────────────────────

  {
    id: 'mv1',
    label: '+5% Damage',
    description: '+5% damage at the start of every run.',
    type: 'minor',
    cost: 4,
    position: { x: 568, y: 358 },
    connections: ['meta_start', 'mv2'],
    stats: { damageMult: 1.05 },
  },
  {
    id: 'mv2',
    label: '+8% Damage',
    description: '+8% damage.',
    type: 'minor',
    cost: 7,
    position: { x: 658, y: 406 },
    connections: ['mv1', 'mv3'],
    stats: { damageMult: 1.08 },
  },
  {
    id: 'mv3',
    label: '+8 Speed',
    description: '+8 movement speed.',
    type: 'minor',
    cost: 7,
    position: { x: 740, y: 440 },
    connections: ['mv2', 'mv_notable'],
    stats: { speedFlat: 8 },
  },
  {
    id: 'mv_notable',
    label: 'Battle-Hardened',
    description: '+12% damage and +12 movement speed.',
    type: 'notable',
    cost: 16,
    position: { x: 818, y: 466 },
    connections: ['mv3', 'stash_relic'],
    stats: { damageMult: 1.12, speedFlat: 12 },
  },

  // ── Fortune — lower-left ──────────────────────────────────────────────────

  {
    id: 'mf1',
    label: '+15 Pickup Radius',
    description: '+15 to Chaos Shard and XP gem pickup radius.',
    type: 'minor',
    cost: 3,
    position: { x: 335, y: 358 },
    connections: ['meta_start', 'mf2'],
    stats: { pickupRadiusFlat: 15 },
  },
  {
    id: 'mf2',
    label: '+20% More Shards',
    description: '20% more Chaos Shards dropped per run.',
    type: 'minor',
    cost: 5,
    position: { x: 242, y: 406 },
    connections: ['mf1', 'mf3'],
    stats: { shardGainMult: 1.20 },
  },
  {
    id: 'mf3',
    label: '+30% More Shards',
    description: '30% more Chaos Shards dropped per run.',
    type: 'minor',
    cost: 8,
    position: { x: 162, y: 440 },
    connections: ['mf2', 'mf_notable'],
    stats: { shardGainMult: 1.30 },
  },
  {
    id: 'mf_notable',
    label: "Veil of Greed",
    description: '+25% more Chaos Shards and +20 pickup radius.',
    type: 'notable',
    cost: 14,
    position: { x: 85, y: 466 },
    connections: ['mf3', 'stash_relic'],
    stats: { shardGainMult: 1.25, pickupRadiusFlat: 20 },
  },

  // ── Keystone: bottom ──────────────────────────────────────────────────────

  {
    id: 'stash_relic',
    label: 'League Relic',
    description: 'Begin each run with a Chaos Relic placed in your inventory.',
    type: 'keystone',
    cost: 25,
    position: { x: 450, y: 520 },
    connections: ['mv_notable', 'mf_notable'],
    stats: { startingRelic: true },
  },
];

/** Quick O(1) lookup by node id. */
export const META_NODE_MAP = Object.fromEntries(META_TREE_NODES.map((n) => [n.id, n]));

/** De-duplicated edge list for SVG rendering. */
export const META_TREE_EDGES = (() => {
  const edges = [];
  const seen  = new Set();
  for (const node of META_TREE_NODES) {
    for (const connId of node.connections) {
      const key = [node.id, connId].sort().join('||');
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ a: node.id, b: connId });
      }
    }
  }
  return edges;
})();
