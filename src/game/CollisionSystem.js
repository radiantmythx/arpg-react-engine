import { SpatialGrid } from './SpatialGrid.js';
import { applyAilmentsOnHit, resolvePenetrationMap } from './data/skillTags.js';
import { scaleDamageMap } from './damageUtils.js';

/** Returns true if two circle entities overlap. */
function circlesOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const minDist = a.radius + b.radius;
  return dx * dx + dy * dy <= minDist * minDist;
}

/**
 * CollisionSystem
 * Uses a SpatialGrid broad phase to bring collision checks from O(P×E)
 * down to O(N) in practice — each entity is only tested against nearby candidates.
 *
 * Call buildGrids(entities) once per frame before the three check methods.
 */
export class CollisionSystem {
  constructor() {
    this._enemyGrid = new SpatialGrid(128);
    this._gemGrid   = new SpatialGrid(128);
    // Reusable scratch array avoids a new allocation per projectile query.
    this._candidates = [];
  }

  /**
   * Rebuild both spatial grids from the current entity pools.
   * Must be called once per frame before any check method.
   */
  buildGrids(entities) {
    this._enemyGrid.clear();
    for (const e of entities.enemies) {
      if (e.active) this._enemyGrid.insert(e);
    }
    // Bosses share the enemy grid so projectile-vs-boss and player-vs-boss
    // collision checks work automatically with no extra code paths.
    for (const b of entities.bosses) {
      if (b.active && !b.isWarning) this._enemyGrid.insert(b);
    }
    this._gemGrid.clear();
    for (const g of entities.gems) {
      if (g.active) this._gemGrid.insert(g);
    }
  }

  /** Number of occupied enemy-grid cells (exposed for the debug overlay). */
  get enemyGridCellCount() {
    return this._enemyGrid.activeCellCount;
  }

  _findChainTarget(proj, sourceEnemy, hostiles) {
    const maxDistSq = (proj.chainRadius ?? 180) * (proj.chainRadius ?? 180);
    let best = null;
    let bestDistSq = Infinity;
    for (const hostile of hostiles) {
      if (!hostile.active || hostile === sourceEnemy) continue;
      if (proj.hitEnemies?.has(hostile)) continue;
      const dx = hostile.x - sourceEnemy.x;
      const dy = hostile.y - sourceEnemy.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > maxDistSq || distSq >= bestDistSq) continue;
      best = hostile;
      bestDistSq = distSq;
    }
    return best;
  }

  _retargetProjectileToEnemy(proj, sourceEnemy, targetEnemy) {
    const speed = Math.hypot(proj.vx, proj.vy) || 1;
    const dx = targetEnemy.x - sourceEnemy.x;
    const dy = targetEnemy.y - sourceEnemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    proj.x = sourceEnemy.x;
    proj.y = sourceEnemy.y;
    proj.vx = (dx / dist) * speed;
    proj.vy = (dy / dist) * speed;
  }

  _spawnForkProjectiles(proj, sourceEnemy, entities) {
    if ((proj.forkCount ?? 0) <= 0) return false;
    const baseAngle = Math.atan2(proj.vy, proj.vx);
    const remainingLifetime = Math.max(0.1, proj.lifetime - proj.age);
    const speed = Math.hypot(proj.vx, proj.vy) || 1;
    const splitCount = Math.max(2, proj.splitProjectiles ?? 2);
    const angleStep = proj.forkSpread ?? 0.34;
    for (let index = 0; index < splitCount; index++) {
      const side = index - (splitCount - 1) / 2;
      const angle = baseAngle + side * angleStep;
      const child = entities.acquireProjectile(
        sourceEnemy.x,
        sourceEnemy.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        {
          damage: proj.damage,
          damageBreakdown: scaleDamageMap(proj.damageBreakdown, 1),
          radius: proj.radius,
          color: proj.color,
          lifetime: remainingLifetime,
          piercing: proj.piercing,
          pierceCount: Number.isFinite(proj.pierceCount) ? proj.pierceCount : undefined,
          forkCount: Math.max(0, (proj.forkCount ?? 0) - 1),
          forkSpread: proj.forkSpread,
          splitProjectiles: proj.splitProjectiles,
          chainCount: proj.chainCount,
          chainRadius: proj.chainRadius,
          chainDamageMult: proj.chainDamageMult,
          chainWeapon: proj.chainWeapon,
          chainConfig: proj.chainConfig,
          onExpire: proj.onExpire,
          onHit: proj.onHit,
          gravity: proj.gravity,
          _spawnX: sourceEnemy.x,
          _spawnY: sourceEnemy.y,
          _homing: false,
          sourceTags: proj.sourceTags,
        },
      );
      if (child) {
        if (!child.hitEnemies) child.hitEnemies = new Set();
        if (proj.hitEnemies) {
          for (const enemy of proj.hitEnemies) child.hitEnemies.add(enemy);
        }
        child.hitEnemies.add(sourceEnemy);
      }
    }
    return true;
  }

  _continueProjectileAfterHit(proj, enemy, entities) {
    const hostiles = entities.getHostiles();
    if (proj.hitEnemies) proj.hitEnemies.add(enemy);

    if ((proj.chainCount ?? 0) > 0) {
      const target = this._findChainTarget(proj, enemy, hostiles);
      if (target) {
        proj.chainCount = Math.max(0, proj.chainCount - 1);
        proj.damage = Math.max(1, Math.round(proj.damage * (proj.chainDamageMult ?? 0.75)));
        if (proj.damageBreakdown) {
          proj.damageBreakdown = scaleDamageMap(proj.damageBreakdown, proj.chainDamageMult ?? 0.75);
        }
        this._retargetProjectileToEnemy(proj, enemy, target);
        return true;
      }
    }

    if ((proj.pierceCount ?? 0) > 0 || proj.pierceCount === Number.POSITIVE_INFINITY) {
      if (Number.isFinite(proj.pierceCount)) proj.pierceCount = Math.max(0, proj.pierceCount - 1);
      return true;
    }

    if (this._spawnForkProjectiles(proj, enemy, entities)) {
      return false;
    }

    return false;
  }

  /**
   * Projectiles vs Enemies — broad phase via enemy grid.
   * On hit: deal damage; deactivate non-piercing projectiles.
   */
  checkProjectilesVsEnemies(entities, engine) {
    const { _enemyGrid, _candidates } = this;
    for (const proj of entities.projectiles) {
      if (!proj.active) continue;
      _candidates.length = 0;
      _enemyGrid.query(proj, _candidates);
      for (const enemy of _candidates) {
        if (!enemy.active) continue;
        if (proj.hitEnemies && proj.hitEnemies.has(enemy)) continue;
        if (circlesOverlap(proj, enemy)) {
          const penetrationMap = resolvePenetrationMap(proj.sourceTags, engine.player);
          const dealt = enemy.takeDamage(proj.damageBreakdown ?? proj.damage, proj.sourceTags, penetrationMap);
          engine.onEnemyHit(enemy, dealt);

          // Elemental ailments from projectile source tags
          if (proj.sourceTags.length && engine.player) {
            applyAilmentsOnHit(proj.sourceTags, proj.damageBreakdown ?? proj.damage, enemy, engine.player);
          }

          // onHit burst (e.g. Fireball AoE detonation)
          if (proj.onHit) proj.onHit(proj, entities, engine);

          if (proj.chainWeapon && typeof proj.chainWeapon.processChain === 'function') {
            const chainCfg = proj.chainConfig ?? proj.chainWeapon.config;
            const hopDecay = chainCfg?.chainDecay ?? 0.25;
            const hopDamage = Math.round(proj.damage * (1 - hopDecay));
            const hops = chainCfg?.maxChains ?? 0;
            if (hopDamage > 0 && hops > 0) {
              proj.chainWeapon.processChain(enemy, entities.getHostiles(), hopDamage, hops, new Set([enemy]), chainCfg);
            }
          }

          proj.active = this._continueProjectileAfterHit(proj, enemy, entities);
          if (!enemy.active) {
            engine.onEnemyKilled(enemy);
          }
          if (!proj.active) break;
        }
      }
    }
  }

  /**
   * Projectiles vs Walls.
   * Non-persistent projectiles are destroyed as soon as their circle overlaps a wall tile
   * or exits the generated map bounds.
   */
  checkProjectilesVsWalls(entities, mapLayout) {
    if (!mapLayout) return;

    const tile = mapLayout.tileSize;
    for (const proj of entities.projectiles) {
      if (!proj.active) continue;

      const left = proj.x - proj.radius;
      const right = proj.x + proj.radius;
      const top = proj.y - proj.radius;
      const bottom = proj.y + proj.radius;

      if (
        left < mapLayout.worldLeft ||
        right > mapLayout.worldLeft + mapLayout.widthPx ||
        top < mapLayout.worldTop ||
        bottom > mapLayout.worldTop + mapLayout.heightPx
      ) {
        proj.active = false;
        continue;
      }

      const minTx = Math.floor((left - mapLayout.worldLeft) / tile);
      const maxTx = Math.floor((right - mapLayout.worldLeft) / tile);
      const minTy = Math.floor((top - mapLayout.worldTop) / tile);
      const maxTy = Math.floor((bottom - mapLayout.worldTop) / tile);

      let hitWall = false;
      for (let ty = minTy; ty <= maxTy && !hitWall; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          if (mapLayout.isWall(tx, ty)) {
            hitWall = true;
            break;
          }
        }
      }

      if (hitWall) proj.active = false;
    }
  }

  /**
   * Player vs Enemies — broad phase via enemy grid.
   * Player takes damage on overlap (invulnerability frames prevent spam).
   */
  checkPlayerVsEnemies(player, entities, engine) {
    const { _enemyGrid, _candidates } = this;
    _candidates.length = 0;
    _enemyGrid.query(player, _candidates);
    for (const enemy of _candidates) {
      if (!enemy.active) continue;
      if (circlesOverlap(player, enemy)) {
        player.takeDamage(enemy.damage);
        if (player.health <= 0) {
          engine.gameOver();
          return;
        }
        // Only fire onPlayerHit when the damage actually landed (invulnerability)
        if (player.invulnerable > 0.45) engine.onPlayerHit(enemy.damage);
      }
    }
  }

  /**
   * Player vs XP Gems — broad phase via gem grid.
   */
  checkPlayerVsGems(player, entities, xpSystem) {
    const { _gemGrid, _candidates } = this;
    _candidates.length = 0;
    _gemGrid.query(player, _candidates);
    for (const gem of _candidates) {
      if (!gem.active) continue;
      if (circlesOverlap(player, gem)) {
        gem.active = false;
        xpSystem.collect(gem.value);
        xpSystem.engine.onGemCollected(gem);
      }
    }
  }

  /**
   * Player vs Chaos Shard Gems — simple O(N) loop (few active at a time).
   * Calls engine.onShardCollected(value) when the player overlaps a shard gem.
   */
  checkPlayerVsShardGems(player, entities, engine) {
    for (const gem of entities.shardGems) {
      if (!gem.active) continue;
      const dx = player.x - gem.x;
      const dy = player.y - gem.y;
      if (dx * dx + dy * dy <= (player.radius + gem.radius) ** 2) {
        gem.active = false;
        engine.onShardCollected(gem.value);
      }
    }
  }

  /**
   * Player vs Gold Gems — simple O(N) loop (common but lightweight entities).
   * Calls engine.onGoldCollected(value) when the player overlaps a gold gem.
   */
  checkPlayerVsGoldGems(player, entities, engine) {
    for (const gem of entities.goldGems) {
      if (!gem.active) continue;
      const dx = player.x - gem.x;
      const dy = player.y - gem.y;
      if (dx * dx + dy * dy <= (player.radius + gem.radius) ** 2) {
        gem.active = false;
        engine.onGoldCollected(gem.value);
      }
    }
  }

  /**
   * Player vs AoE Zones — simple O(N) loop (boss zones are few in number).
   * Damage is clock-gated by Player.takeDamage's 0.5 s invulnerability timer.
   */
  checkPlayerVsAoeZones(player, entities, engine) {
    for (const zone of entities.aoeZones) {
      if (!zone.active || zone.isWarning) continue;
      const dx = player.x - zone.x;
      const dy = player.y - zone.y;
      if (dx * dx + dy * dy <= zone.radius * zone.radius) {
        const prevInvuln = player.invulnerable;
        player.takeDamage(zone.damage);
        if (player.health <= 0) { engine.gameOver(); return; }
        if (prevInvuln <= 0 && player.invulnerable > 0) engine.onPlayerHit(zone.damage);
      }
    }
  }

  /**
   * Push a circular entity out of nearby wall tiles in a generated map layout.
   * @param {{ x: number, y: number, radius: number }} entity
   * @param {object|null} mapLayout
   */
  resolveEntityVsWalls(entity, mapLayout) {
    if (!entity || !mapLayout) return;

    const tile = mapLayout.tileSize;
    const left = entity.x - entity.radius;
    const right = entity.x + entity.radius;
    const top = entity.y - entity.radius;
    const bottom = entity.y + entity.radius;

    const minTx = Math.floor((left - mapLayout.worldLeft) / tile);
    const maxTx = Math.floor((right - mapLayout.worldLeft) / tile);
    const minTy = Math.floor((top - mapLayout.worldTop) / tile);
    const maxTy = Math.floor((bottom - mapLayout.worldTop) / tile);

    // A few passes handle corner and multi-tile penetrations robustly.
    for (let pass = 0; pass < 3; pass++) {
      let pushed = false;
      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          if (!mapLayout.isWall(tx, ty)) continue;
          if (this._pushCircleOutOfWallTile(entity, tx, ty, mapLayout)) pushed = true;
        }
      }
      if (!pushed) break;
    }

    // Keep entities from leaving the generated map bounds.
    const minX = mapLayout.worldLeft + entity.radius;
    const maxX = mapLayout.worldLeft + mapLayout.widthPx - entity.radius;
    const minY = mapLayout.worldTop + entity.radius;
    const maxY = mapLayout.worldTop + mapLayout.heightPx - entity.radius;
    entity.x = Math.max(minX, Math.min(maxX, entity.x));
    entity.y = Math.max(minY, Math.min(maxY, entity.y));
  }

  /** @private */
  _pushCircleOutOfWallTile(entity, tx, ty, mapLayout) {
    const tile = mapLayout.tileSize;
    const rx = mapLayout.worldLeft + tx * tile;
    const ry = mapLayout.worldTop + ty * tile;
    const rw = tile;
    const rh = tile;

    const nearestX = Math.max(rx, Math.min(entity.x, rx + rw));
    const nearestY = Math.max(ry, Math.min(entity.y, ry + rh));
    let dx = entity.x - nearestX;
    let dy = entity.y - nearestY;
    let distSq = dx * dx + dy * dy;
    const r = entity.radius;

    if (distSq >= r * r) return false;

    if (distSq < 1e-8) {
      // Center inside tile: push along shallowest axis to nearest edge.
      const leftPen = Math.abs(entity.x - rx);
      const rightPen = Math.abs(rx + rw - entity.x);
      const topPen = Math.abs(entity.y - ry);
      const bottomPen = Math.abs(ry + rh - entity.y);
      const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);

      if (minPen === leftPen) entity.x = rx - r - 0.01;
      else if (minPen === rightPen) entity.x = rx + rw + r + 0.01;
      else if (minPen === topPen) entity.y = ry - r - 0.01;
      else entity.y = ry + rh + r + 0.01;
      return true;
    }

    const dist = Math.sqrt(distSq);
    const overlap = r - dist;
    dx /= dist;
    dy /= dist;
    entity.x += dx * (overlap + 0.01);
    entity.y += dy * (overlap + 0.01);
    return true;
  }
}
