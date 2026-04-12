export function normalizeDirection(dx, dy, fallbackX = 1, fallbackY = 0) {
  const dist = Math.hypot(dx, dy);
  if (dist < 0.0001) return { x: fallbackX, y: fallbackY };
  return { x: dx / dist, y: dy / dist };
}

export function buildSpreadAngles(baseAngle, projectileCount, spreadStep = 0.14) {
  const total = Math.max(1, Math.floor(projectileCount || 1));
  if (total === 1) return [baseAngle];
  const start = baseAngle - (spreadStep * (total - 1)) / 2;
  return Array.from({ length: total }, (_, index) => start + spreadStep * index);
}

export function getProjectileSupportState(stats = {}, options = {}) {
  const baseProjectiles = Math.max(1, Math.floor(options.baseProjectiles ?? 1));
  const playerProjectileBonus = Math.max(0, Math.floor(options.playerProjectileBonus ?? 0));
  const extraProjectiles = Math.max(0, Math.floor(stats._extraProjectiles ?? 0));

  return {
    extraProjectiles,
    totalProjectiles: baseProjectiles + playerProjectileBonus + extraProjectiles,
    speedMult: Number.isFinite(stats._speedMult) ? stats._speedMult : 1,
    rangeMult: Number.isFinite(stats._rangeMult) ? stats._rangeMult : 1,
    pierceCount: Math.max(0, Math.floor(stats._pierce ?? 0)),
    forkCount: Math.max(0, Math.floor(stats._forks ?? 0)),
    chainCount: Math.max(0, Math.floor(stats._chains ?? 0)),
  };
}

export function scaleProjectileMotion(baseSpeed, baseLifetime, supportState) {
  return {
    speed: Math.max(1, baseSpeed * (supportState?.speedMult ?? 1)),
    lifetime: Math.max(0.1, baseLifetime * (supportState?.rangeMult ?? 1)),
  };
}

export function buildProjectileConfig(baseConfig, supportState, sourceTags, overrides = {}) {
  const piercing = overrides.piercing ?? baseConfig.piercing ?? false;
  const inheritedPierceCount = Number.isFinite(baseConfig.pierceCount) ? baseConfig.pierceCount : 0;
  const pierceCount = piercing === true
    ? Number.POSITIVE_INFINITY
    : Math.max(0, inheritedPierceCount + (supportState?.pierceCount ?? 0));

  return {
    ...baseConfig,
    ...overrides,
    sourceTags: overrides.sourceTags ?? baseConfig.sourceTags ?? sourceTags,
    piercing,
    pierceCount,
    forkCount: overrides.forkCount ?? baseConfig.forkCount ?? supportState?.forkCount ?? 0,
    forkSpread: overrides.forkSpread ?? baseConfig.forkSpread ?? 0.34,
    splitProjectiles: overrides.splitProjectiles ?? baseConfig.splitProjectiles ?? 2,
    chainCount: overrides.chainCount ?? baseConfig.chainCount ?? supportState?.chainCount ?? 0,
    chainRadius: overrides.chainRadius ?? baseConfig.chainRadius ?? 180,
    chainDamageMult: overrides.chainDamageMult ?? baseConfig.chainDamageMult ?? 0.75,
  };
}