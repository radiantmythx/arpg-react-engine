import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { Projectile } from './entities/Projectile.js';
import { XPGem } from './entities/XPGem.js';

/**
 * EntityManager
 * Owns all live entities split into typed pools, plus object pools for
 * frequently-allocated types (Projectile, XPGem) to reduce GC pressure.
 *
 * Use acquireProjectile() / acquireGem() at creation sites instead of
 * `new Projectile()` / `new XPGem()`. Both methods recycle an inactive
 * instance where possible, falling back to allocation only when the pool
 * has no free slots.
 */
export class EntityManager {
  constructor() {
    this.player = null;
    this.enemies = [];
    this.projectiles = [];
    this.gems = [];
    /** Item drops are rare; no pooling needed — plain array of active ItemDrop instances. */
    this.itemDrops = [];
    /** Boss entities — updated separately with engine reference, inserted into enemy grid. */
    this.bosses    = [];
    /** Active AoE damage zones placed by boss attacks. */
    this.aoeZones  = [];
    /** Chaos Shard collectibles (meta-currency that persists between runs). */
    this.shardGems = [];
    /** Gold collectibles for vendor currency. */
    this.goldGems  = [];
    /** Reused scratch list for hostile-target queries (enemies + active bosses). */
    this._hostilesScratch = [];
  }

  /**
   * Returns all currently targetable hostile units (enemies + non-warning bosses).
   * The returned array is a reused scratch buffer and must be consumed immediately.
   */
  getHostiles() {
    const out = this._hostilesScratch;
    out.length = 0;
    for (const e of this.enemies) {
      if (e.active) out.push(e);
    }
    for (const b of this.bosses) {
      if (b.active && !b.isWarning) out.push(b);
    }
    return out;
  }

  add(entity) {
    if (entity instanceof Player) {
      this.player = entity;
    } else if (entity.isBoss) {
      // BossEnemy: separate pool so it can receive the engine reference in update().
      this.bosses.push(entity);
    } else if (entity instanceof Enemy) {
      this.enemies.push(entity);
    } else if (entity instanceof Projectile) {
      this.projectiles.push(entity);
    } else if (entity instanceof XPGem) {
      this.gems.push(entity);
    }
  }

  /**
   * Object-pool acquire for Projectile.
   * Recycles the first inactive Projectile found in the pool; otherwise allocates.
   * The returned instance is already in this.projectiles.
   */
  acquireProjectile(x, y, vx, vy, config) {
    for (const p of this.projectiles) {
      if (!p.active) {
        p.reset(x, y, vx, vy, config);
        return p;
      }
    }
    const p = new Projectile(x, y, vx, vy, config);
    this.projectiles.push(p);
    return p;
  }

  /**
   * Object-pool acquire for XPGem.
   * Recycles the first inactive XPGem found in the pool; otherwise allocates.
   * The returned instance is already in this.gems.
   */
  acquireGem(x, y, value) {
    for (const g of this.gems) {
      if (!g.active) {
        g.reset(x, y, value);
        return g;
      }
    }
    const g = new XPGem(x, y, value);
    this.gems.push(g);
    return g;
  }

  /** Add a boss-spawned AoEZone to the active pool. */
  addAoeZone(zone) {
    this.aoeZones.push(zone);
  }

  /** Add a ChaosShardGem to the active pool. */
  addShardGem(gem) {
    this.shardGems.push(gem);
  }

  /** Add a GoldGem to the active pool. */
  addGoldGem(gem) {
    this.goldGems.push(gem);
  }

  /**
   * Remove all entities with active === false from each pool.
   * NOTE: projectiles and gems are NOT filtered out here — their slots stay in
   * the arrays so the object pool can reuse them next frame. Only enemies are
   * filtered because their count is managed by the WaveSpawner and they are not
   * pooled yet.
   */
  cleanup() {
    this.enemies   = this.enemies.filter((e) => e.active);
    this.bosses    = this.bosses.filter((b) => b.active);
    this.aoeZones  = this.aoeZones.filter((z) => z.active);
    this.shardGems = this.shardGems.filter((s) => s.active);
    this.goldGems  = this.goldGems.filter((g) => g.active);
    this.itemDrops = this.itemDrops.filter((d) => d.active);
    // Inactive projectiles/gems stay in the array as free pool slots.
    // Cap accumulated dead slots to avoid unbounded array growth over a long run.
    if (this.projectiles.length > 300) {
      this.projectiles = this.projectiles.filter((p) => p.active);
    }
    if (this.gems.length > 400) {
      this.gems = this.gems.filter((g) => g.active);
    }
  }

  /** Wipe all entity pools (used on game restart). */
  clear() {
    this.player    = null;
    this.enemies   = [];
    this.projectiles = [];
    this.gems      = [];
    this.itemDrops = [];
    this.bosses    = [];
    this.aoeZones  = [];
    this.shardGems = [];
    this.goldGems  = [];
  }

  get counts() {
    return {
      enemies:     this.enemies.length,
      bosses:      this.bosses.length,
      projectiles: this.projectiles.filter((p) => p.active).length,
      gems:        this.gems.filter((g) => g.active).length,
      itemDrops:   this.itemDrops.length,
      shardGems:   this.shardGems.length,
      goldGems:    this.goldGems.length,
    };
  }
}
