/**
 * Entity — base class for all game objects.
 * All entities live in EntityManager pools and are removed when active === false.
 */
export class Entity {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 8;
    this.active = true;
  }
}
