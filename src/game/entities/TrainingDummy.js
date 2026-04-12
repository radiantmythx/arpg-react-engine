import { Enemy } from './Enemy.js';

const DUMMY_CONFIG = {
  id: 'TRAINING_DUMMY',
  radius: 24,
  speed: 0,
  health: 1_000_000_000,
  damage: 0,
  xpValue: 0,
  color: '#8f9aa5',
  aggroRadius: 99999,
  propagationRadius: 0,
};

export class TrainingDummy extends Enemy {
  constructor(x, y) {
    super(x, y, DUMMY_CONFIG);
    this.isTrainingDummy = true;
    this.aiState = 'aggro';
  }

  takeDamage(amountOrMap, sourceTags = null, sourcePenetration = null) {
    const dealt = super.takeDamage(amountOrMap, sourceTags, sourcePenetration);
    // Dummy never dies; it is a stable target for DPS and mana-flow tests.
    this.active = true;
    this.health = this.maxHealth;
    return dealt;
  }

  draw(renderer) {
    super.draw(renderer);
    renderer.drawText(this.x, this.y - this.radius - 14, 'Training Dummy', '#d3d9df', 11, 'center');
  }
}
