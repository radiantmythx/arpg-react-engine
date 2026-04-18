import { Skill } from './Skill.js';
import {
  buildProjectileConfig,
  buildSpreadAngles,
  getProjectileSupportState,
  normalizeDirection,
  scaleProjectileMotion,
} from '../projectileSupport.js';

class BowProjectileSkill extends Skill {
  constructor(config, tags = ['Attack', 'Projectile', 'Bow', 'Physical']) {
    super(config);
    this.tags = tags;
    this.isActive = true;  // hotbar skill — fires only on key press, mana cost applied by ActiveSkillSystem
    this._timer = this.cooldown;  // start ready
  }

  _fireProjectiles(player, entities, engine, options = {}) {
    const stats = this.computedStats(player);
    const direction = normalizeDirection(player.facingX ?? 1, player.facingY ?? 0, 1, 0);
    const supportState = getProjectileSupportState(stats, {
      playerProjectileBonus: player.projectileCountBonus ?? 0,
    });
    const motion = scaleProjectileMotion(this.config.projectileSpeed, this.config.projectileLifetime, supportState);
    const baseAngle = Math.atan2(direction.y, direction.x);

    const baseCount = Math.max(1, options.baseProjectiles ?? 1);
    const totalProjectiles = Math.max(baseCount, supportState.totalProjectiles);
    const spread = options.spread ?? 0.1;
    const piercing = !!(options.piercing ?? this.config.piercing ?? false);

    for (const angle of buildSpreadAngles(baseAngle, totalProjectiles, spread)) {
      entities.acquireProjectile(
        player.x,
        player.y,
        Math.cos(angle) * motion.speed,
        Math.sin(angle) * motion.speed,
        buildProjectileConfig({
          damage: stats.damage,
          damageBreakdown: stats.damageBreakdown,
          radius: this.config.projectileRadius,
          color: this.config.color,
          lifetime: motion.lifetime,
          piercing,
        }, supportState, this.tags),
      );
    }

    if (engine) engine.onSkillFire();
  }
}

const BOW_REQ = ['bow'];
const BOW_HINT = 'Equip a Bow to use this skill.';

export class PiercingShot extends BowProjectileSkill {
  constructor() {
    super({
      id: 'PIERCING_SHOT',
      name: 'Piercing Shot',
      description: 'Fires a piercing bow shot that cuts through enemies.',
      requiresWeaponType: BOW_REQ,
      requirementHint: BOW_HINT,
      cooldown: 0,
      castTime: 0.30,   // draw time; reduced by attack speed
      damage: 18,
      manaCost: 6,
      projectileSpeed: 560,
      projectileRadius: 4,
      projectileLifetime: 1.25,
      color: '#9cd3ff',
      piercing: true,
    });
  }

  fire(player, entities, engine) {
    this._fireProjectiles(player, entities, engine, { piercing: true });
  }
}

export class SplitShot extends BowProjectileSkill {
  constructor() {
    super({
      id: 'SPLIT_SHOT',
      name: 'Split Shot',
      description: 'Fires a fan of arrows for broad coverage.',
      requiresWeaponType: BOW_REQ,
      requirementHint: BOW_HINT,
      cooldown: 0,
      castTime: 0.40,   // draw time; reduced by attack speed
      damage: 14,
      manaCost: 8,
      projectileSpeed: 520,
      projectileRadius: 4,
      projectileLifetime: 1.1,
      color: '#8de0cf',
    });
  }

  fire(player, entities, engine) {
    this._fireProjectiles(player, entities, engine, { baseProjectiles: 3, spread: 0.2 });
  }
}

export class FrostVolley extends BowProjectileSkill {
  constructor() {
    super({
      id: 'FROST_VOLLEY',
      name: 'Frost Volley',
      description: 'Rapid frost-tipped arrows that chill foes.',
      requiresWeaponType: BOW_REQ,
      requirementHint: BOW_HINT,
      cooldown: 0,
      castTime: 0.28,   // rapid nock; reduced by attack speed
      damage: 13,
      manaCost: 6,
      projectileSpeed: 550,
      projectileRadius: 4,
      projectileLifetime: 1.15,
      color: '#7fd6ff',
    }, ['Attack', 'Projectile', 'Bow', 'Frost']);
  }

  fire(player, entities, engine) {
    this._fireProjectiles(player, entities, engine, { baseProjectiles: 2, spread: 0.14 });
  }
}

export class ThunderVolley extends BowProjectileSkill {
  constructor() {
    super({
      id: 'THUNDER_VOLLEY',
      name: 'Thunder Volley',
      description: 'Electrified arrows streak forward in a tight burst.',
      requiresWeaponType: BOW_REQ,
      requirementHint: BOW_HINT,
      cooldown: 0,
      castTime: 0.35,   // draw time; reduced by attack speed
      damage: 16,
      manaCost: 7,
      projectileSpeed: 600,
      projectileRadius: 4,
      projectileLifetime: 1.1,
      color: '#ffe66b',
    }, ['Attack', 'Projectile', 'Bow', 'Thunder']);
  }

  fire(player, entities, engine) {
    this._fireProjectiles(player, entities, engine, { baseProjectiles: 2, spread: 0.11 });
  }
}

export class EmberArrow extends BowProjectileSkill {
  constructor() {
    super({
      id: 'EMBER_ARROW',
      name: 'Ember Arrow',
      description: 'A blazing arrow that carries light blaze damage.',
      requiresWeaponType: BOW_REQ,
      requirementHint: BOW_HINT,
      cooldown: 0,
      castTime: 0.32,   // draw time; reduced by attack speed
      damage: 17,
      manaCost: 7,
      projectileSpeed: 540,
      projectileRadius: 4,
      projectileLifetime: 1.2,
      color: '#ff9c6b',
    }, ['Attack', 'Projectile', 'Bow', 'Blaze']);
  }

  fire(player, entities, engine) {
    this._fireProjectiles(player, entities, engine);
  }
}

export class GaleShot extends BowProjectileSkill {
  constructor() {
    super({
      id: 'GALE_SHOT',
      name: 'Gale Shot',
      description: 'A high-speed arrow that favors quick firing cadence.',
      requiresWeaponType: BOW_REQ,
      requirementHint: BOW_HINT,
      cooldown: 0,
      castTime: 0.22,   // fastest draw; reduced by attack speed
      damage: 12,
      manaCost: 5,
      projectileSpeed: 700,
      projectileRadius: 3,
      projectileLifetime: 1.0,
      color: '#b2f1ff',
    });
  }

  fire(player, entities, engine) {
    this._fireProjectiles(player, entities, engine);
  }
}

export class SeekerArrow extends BowProjectileSkill {
  constructor() {
    super({
      id: 'SEEKER_ARROW',
      name: 'Seeker Arrow',
      description: 'A focused shot tuned for heavier single target hits.',
      requiresWeaponType: BOW_REQ,
      requirementHint: BOW_HINT,
      cooldown: 0,
      castTime: 0.45,   // held draw; reduced by attack speed
      damage: 24,
      manaCost: 9,
      projectileSpeed: 580,
      projectileRadius: 4,
      projectileLifetime: 1.25,
      color: '#d8f3ff',
    });
  }

  fire(player, entities, engine) {
    this._fireProjectiles(player, entities, engine);
  }
}

export class Barrage extends BowProjectileSkill {
  constructor() {
    super({
      id: 'BARRAGE',
      name: 'Barrage',
      description: 'Rapid sequence of arrows in a narrow spread.',
      requiresWeaponType: BOW_REQ,
      requirementHint: BOW_HINT,
      cooldown: 0,
      castTime: 0.22,   // rapid fire; reduced by attack speed
      damage: 10,
      manaCost: 6,
      projectileSpeed: 590,
      projectileRadius: 3,
      projectileLifetime: 1.05,
      color: '#bfe5ff',
    });
  }

  fire(player, entities, engine) {
    this._fireProjectiles(player, entities, engine, { baseProjectiles: 2, spread: 0.08 });
  }
}

export class StarfallArrow extends BowProjectileSkill {
  constructor() {
    super({
      id: 'STARFALL_ARROW',
      name: 'Starfall Arrow',
      description: 'Sacred arrow that blends physical and holy damage.',
      requiresWeaponType: BOW_REQ,
      requirementHint: BOW_HINT,
      cooldown: 0,
      castTime: 0.38,   // draw time; reduced by attack speed
      damage: 19,
      manaCost: 8,
      projectileSpeed: 560,
      projectileRadius: 4,
      projectileLifetime: 1.2,
      color: '#ffe8a6',
    }, ['Attack', 'Projectile', 'Bow', 'Holy']);
  }

  fire(player, entities, engine) {
    this._fireProjectiles(player, entities, engine);
  }
}
