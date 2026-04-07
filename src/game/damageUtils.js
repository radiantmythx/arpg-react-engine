export const ELEMENT_TYPES = ['Physical', 'Blaze', 'Thunder', 'Frost', 'Holy', 'Unholy'];

// Per-element damage variance bands.
// Thunder is intentionally swingy at level 1 (e.g. 20 base -> ~2..24).
export const ELEMENT_VARIANCE = Object.freeze({
  Physical: [0.85, 1.15],
  Blaze:    [0.65, 1.35],
  Thunder:  [0.10, 1.20],
  Frost:    [0.70, 1.20],
  Holy:     [0.80, 1.20],
  Unholy:   [0.60, 1.35],
});

export function makeDamageRange(baseValue, element) {
  const base = Math.max(0, Number(baseValue) || 0);
  const [minMult, maxMult] = ELEMENT_VARIANCE[element] ?? [1, 1];
  const min = Math.max(0, Math.round(base * minMult));
  const max = Math.max(min, Math.round(base * maxMult));
  return { min, max };
}

export function averageDamageEntry(entry) {
  if (Number.isFinite(entry)) return entry;
  if (entry && typeof entry === 'object') {
    const min = Number(entry.min);
    const max = Number(entry.max);
    if (Number.isFinite(min) && Number.isFinite(max)) return (min + max) / 2;
  }
  return 0;
}

export function rollDamageEntry(entry) {
  if (Number.isFinite(entry)) return entry;
  if (entry && typeof entry === 'object') {
    const min = Number(entry.min);
    const max = Number(entry.max);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      return lo + Math.random() * (hi - lo);
    }
  }
  return 0;
}

export function sumAverageDamageMap(damageMap) {
  if (!damageMap || typeof damageMap !== 'object') return 0;
  let total = 0;
  for (const value of Object.values(damageMap)) total += averageDamageEntry(value);
  return total;
}

export function scaleDamageMap(damageMap, factor) {
  if (!damageMap || typeof damageMap !== 'object') return null;
  const out = {};
  for (const [key, value] of Object.entries(damageMap)) {
    if (Number.isFinite(value)) {
      out[key] = Math.round(value * factor);
      continue;
    }
    if (value && typeof value === 'object') {
      const min = Number(value.min);
      const max = Number(value.max);
      if (Number.isFinite(min) && Number.isFinite(max)) {
        out[key] = {
          min: Math.max(0, Math.round(min * factor)),
          max: Math.max(0, Math.round(max * factor)),
        };
      }
    }
  }
  return out;
}

export function firstTaggedElement(sourceTags = []) {
  if (!Array.isArray(sourceTags)) return null;
  for (const tag of sourceTags) {
    if (ELEMENT_TYPES.includes(tag)) return tag;
  }
  return null;
}
