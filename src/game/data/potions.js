import { POTION_TUNING } from '../content/tuning/index.js';

export const POTION_DEFS = [
  {
    id: 'minor_life_potion',
    name: 'Minor Life Potion',
    icon: '❤',
    color: '#ff6b6b',
    maxCharges: 28,
    chargesPerUse: 10,
    duration: 2.6,
    effects: [{ type: 'life_regen_per_s', value: 20 }],
  },
  {
    id: 'minor_mana_potion',
    name: 'Minor Mana Potion',
    icon: '✦',
    color: '#74b9ff',
    maxCharges: 34,
    chargesPerUse: 12,
    duration: 2.6,
    effects: [{ type: 'mana_regen_per_s', value: 23 }],
  },
  {
    id: 'quicksilver_potion',
    name: 'Quicksilver Potion',
    icon: '⚡',
    color: '#f6d363',
    maxCharges: 26,
    chargesPerUse: 14,
    duration: 3.6,
    effects: [{ type: 'move_speed_pct', value: 0.24 }],
  },
];

export const POTION_MAP = Object.fromEntries(POTION_DEFS.map((def) => [def.id, def]));

function potionWeightByAreaLevel(id, areaLevel = 1) {
  if (id === 'minor_life_potion') return areaLevel < 18 ? 1.25 : 1.0;
  if (id === 'minor_mana_potion') return areaLevel < 18 ? 1.15 : 1.0;
  if (id === 'quicksilver_potion') {
    if (areaLevel < 18) return 0;
    if (areaLevel < 35) return 0.55;
    return 1.0;
  }
  return 1;
}

export const DEFAULT_POTION_SLOT_IDS = [
  'minor_life_potion',
  'minor_mana_potion',
  null,
  null,
];

export function createPotionItem(potionDefOrId) {
  const def = typeof potionDefOrId === 'string' ? POTION_MAP[potionDefOrId] : potionDefOrId;
  if (!def) return null;
  return {
    uid: `potion_${def.id}`,
    id: def.id,
    type: 'potion',
    slot: 'potion',
    potionId: def.id,
    name: def.name,
    rarity: 'magic',
    color: def.color,
    icon: def.icon,
    description: buildPotionDescription(def),
    gridW: 1,
    gridH: 2,
    potion: {
      maxCharges: def.maxCharges,
      chargesPerUse: def.chargesPerUse,
      duration: def.duration,
      effects: def.effects.map((effect) => ({ ...effect })),
    },
  };
}

export function createDefaultPotionBelt() {
  return DEFAULT_POTION_SLOT_IDS.map((id) => (id ? createPotionItem(id) : null));
}

export function rollPotionDrop({ areaLevel = 1, isChampion = false, isBoss = false } = {}) {
  const level = Math.max(1, Math.floor(Number(areaLevel) || 1));
  const totalWeight = POTION_DEFS.reduce((acc, def) => acc + potionWeightByAreaLevel(def.id, level), 0);
  if (totalWeight <= 0) return null;

  let roll = Math.random() * totalWeight;
  let chosen = POTION_DEFS[0];
  for (const def of POTION_DEFS) {
    roll -= potionWeightByAreaLevel(def.id, level);
    if (roll <= 0) {
      chosen = def;
      break;
    }
  }

  if (!isBoss && !isChampion && chosen.id === 'quicksilver_potion' && level < 18) {
    chosen = POTION_MAP.minor_life_potion;
  }

  return createPotionItem(chosen);
}

export function formatPotionEffectLine(effectType, value) {
  const v = Number(value) || 0;
  if (effectType === 'life_regen_per_s') return `Life Regen/s: +${v.toFixed(1)}`;
  if (effectType === 'mana_regen_per_s') return `Mana Regen/s: +${v.toFixed(1)}`;
  if (effectType === 'move_speed_pct') return `Move Speed: +${Math.round(v * 100)}%`;
  return `${effectType}: ${v.toFixed(2)}`;
}

export function normalizePotionBelt(savedSlots = []) {
  const size = POTION_TUNING.slotCount;
  const out = [];
  for (let i = 0; i < size; i++) {
    const saved = savedSlots[i] ?? null;
    if (!saved) {
      const defaultId = DEFAULT_POTION_SLOT_IDS[i];
      out.push(defaultId ? createPotionItem(defaultId) : null);
      continue;
    }
    const potionId = saved.potionId ?? saved.id ?? null;
    const reconstructed = potionId && POTION_MAP[potionId]
      ? createPotionItem(potionId)
      : null;
    out.push(reconstructed);
  }
  return out;
}

function buildPotionDescription(def) {
  const rows = [];
  for (const effect of def.effects ?? []) {
    if (effect.type === 'life_regen_per_s') {
      rows.push(`+${Math.round(effect.value)} life regen/s while drinking`);
    } else if (effect.type === 'mana_regen_per_s') {
      rows.push(`+${Math.round(effect.value)} mana regen/s while drinking`);
    } else if (effect.type === 'move_speed_pct') {
      rows.push(`+${Math.round(effect.value * 100)}% movement speed while drinking`);
    }
  }
  return `${rows.join('. ')}. ${Math.round(def.duration * 10) / 10}s effect.`;
}
