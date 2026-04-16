import { NODES } from '../../data/passiveTree/index.js';
import { isKnownPassiveStatKey } from '../../data/statKeys.js';

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

export function validatePassiveTreeNodes() {
  const errors = [];
  const warnings = [];

  for (let i = 0; i < NODES.length; i++) {
    const node = NODES[i];
    const loc = `PASSIVE_NODES[${i}]`;
    if (!node || typeof node !== 'object') {
      errors.push(`${loc}: node must be an object`);
      continue;
    }
    const id = node.id ?? `index-${i}`;
    const stats = node.stats ?? {};
    if (typeof stats !== 'object' || Array.isArray(stats)) {
      errors.push(`${loc} (${id}): stats must be an object`);
      continue;
    }
    for (const [statKey, value] of Object.entries(stats)) {
      if (!isKnownPassiveStatKey(statKey)) {
        errors.push(`${loc} (${id}): unknown passive stat key '${statKey}'`);
      }
      if (!isFiniteNumber(value)) {
        errors.push(`${loc} (${id}): stat '${statKey}' must be a finite number`);
      }
    }
  }

  return { errors, warnings };
}