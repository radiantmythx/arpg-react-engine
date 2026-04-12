import { SCALING_CONFIG, clampAreaLevel } from '../../config/scalingConfig.js';

function hashString(text = '') {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clampPartIndex(parts, partIndex = 1) {
  const max = Math.max(1, parts.length || 1);
  const index = Math.floor(Number(partIndex) || 1);
  return Math.max(1, Math.min(max, index));
}

export function getActBand(act, config = SCALING_CONFIG) {
  const actNumber = Math.max(1, Math.floor(Number(act) || 1));
  return config.actBands.find((entry) => entry.act === actNumber) ?? config.actBands[0] ?? { act: 1, parts: [[1, 1]] };
}

export function resolveActPartRange(act, partIndex = 1, config = SCALING_CONFIG) {
  const band = getActBand(act, config);
  const idx = clampPartIndex(band.parts, partIndex) - 1;
  const [minRaw, maxRaw] = band.parts[idx] ?? band.parts[0] ?? [1, 1];
  const min = clampAreaLevel(minRaw);
  const max = clampAreaLevel(maxRaw);
  return { act: band.act, partIndex: idx + 1, min: Math.min(min, max), max: Math.max(min, max), partsInAct: band.parts.length };
}

export function inferCampaignProgress(mapDef, config = SCALING_CONFIG) {
  const id = String(mapDef?.id ?? 'act1_unknown');
  const idAct = id.match(/^act(\d+)_/i);
  const inferredAct = idAct ? Number(idAct[1]) : null;
  const act = Math.max(1, Math.floor(Number(mapDef?.act ?? inferredAct ?? 1)));
  const partsInAct = getActBand(act, config).parts.length || 1;
  const partIndex = clampPartIndex(getActBand(act, config).parts, mapDef?.campaignPart ?? partsInAct);
  const zoneId = String(mapDef?.campaignZoneId ?? mapDef?.id ?? `act${act}_part${partIndex}`);
  return { act, partIndex, zoneId };
}

export function resolveCampaignAreaLevel(progress, config = SCALING_CONFIG) {
  const { act, partIndex, zoneId } = progress ?? {};
  const range = resolveActPartRange(act, partIndex, config);
  const span = Math.max(0, range.max - range.min);
  const midpoint = range.min + Math.floor(span / 2);
  const variance = Math.max(0, Math.floor(config.campaign?.zoneLevelVariance ?? 0));
  if (variance <= 0 || span <= 0) {
    return clampAreaLevel(midpoint);
  }

  const raw = hashString(`${range.act}:${range.partIndex}:${zoneId}`);
  const offset = (raw % (variance * 2 + 1)) - variance;
  return clampAreaLevel(Math.max(range.min, Math.min(range.max, midpoint + offset)));
}

export function buildCampaignPartProgression(config = SCALING_CONFIG) {
  const steps = [];
  for (const actBand of config.actBands) {
    const parts = Array.isArray(actBand.parts) ? actBand.parts : [];
    for (let i = 0; i < parts.length; i += 1) {
      const partIndex = i + 1;
      const zoneId = `act${actBand.act}_part${partIndex}`;
      const areaLevel = resolveCampaignAreaLevel({ act: actBand.act, partIndex, zoneId }, config);
      steps.push({ act: actBand.act, partIndex, zoneId, areaLevel, ...resolveActPartRange(actBand.act, partIndex, config) });
    }
  }
  return steps;
}

export function validateCampaignTransitions(config = SCALING_CONFIG) {
  const errors = [];
  const warnings = [];
  const progression = buildCampaignPartProgression(config);
  const minDelta = Number(config.campaign?.zoneExitDeltaMin ?? 1);
  const maxDelta = Number(config.campaign?.zoneExitDeltaMax ?? 3);

  for (let i = 1; i < progression.length; i += 1) {
    const prev = progression[i - 1];
    const curr = progression[i];
    const delta = curr.areaLevel - prev.areaLevel;
    const within = delta >= minDelta && delta <= maxDelta;
    if (!within) {
      errors.push(
        `Campaign transition act${prev.act}/part${prev.partIndex} -> act${curr.act}/part${curr.partIndex} has delta ${delta} (expected ${minDelta}-${maxDelta})`,
      );
    }
  }

  if (!progression.length) {
    warnings.push('Campaign progression is empty; no act band transitions validated.');
  }

  return { errors, warnings, progression };
}
