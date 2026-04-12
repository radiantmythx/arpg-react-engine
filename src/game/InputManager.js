/**
 * InputManager
 * Listens to keydown/keyup on window and exposes a simple query API.
 * Always call destroy() when tearing down the engine to remove listeners.
 */
export class InputManager {
  constructor() {
    this._keys = new Set();
    /** Keys pressed this frame; cleared at end of each frame via clearJustPressed(). */
    this._justPressed = new Set();
    /** One-frame virtual Q/E/R presses from on-screen controls. */
    this._virtualSkillPress = new Set();
    /** Held primary attack state from on-screen controls. */
    this._virtualPrimaryHeld = false;
    /** Virtual joystick movement vector (-1..1 per axis). */
    this._virtualMove = { dx: 0, dy: 0 };
    /** Optional virtual aim override vector from touch input. */
    this._virtualAim = { dx: 0, dy: 0 };
    this._onKeyDown = (e) => { this._keys.add(e.code); this._justPressed.add(e.code); };
    this._onKeyUp = (e) => this._keys.delete(e.code);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  /** Returns true if the given key code is currently held. */
  isDown(code) {
    return this._keys.has(code);
  }

  /**
   * Returns which active-skill hotbar keys were pressed this frame.
   * Call clearJustPressed() at the end of each update tick.
   */
  getSkillActivations() {
    return {
      space: this._justPressed.has('Space') || this._virtualPrimaryHeld,
      q: this._justPressed.has('KeyQ') || this._virtualSkillPress.has('KeyQ'),
      e: this._justPressed.has('KeyE') || this._virtualSkillPress.has('KeyE'),
      r: this._justPressed.has('KeyR') || this._virtualSkillPress.has('KeyR'),
    };
  }

  /** Returns true if the given key code was pressed this frame. */
  wasPressed(code) {
    return this._justPressed.has(code);
  }

  /** Clear the rising-edge set. Must be called at the end of every update frame. */
  clearJustPressed() {
    this._justPressed.clear();
    this._virtualSkillPress.clear();
  }

  /**
   * Returns a normalised {dx, dy} movement vector from WASD / Arrow keys.
   * Diagonal movement is normalised to length 1.
   */
  getMovement() {
    let dx = 0;
    let dy = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp'))    dy -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown'))  dy += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft'))  dx -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) dx += 1;

    dx += this._virtualMove.dx;
    dy += this._virtualMove.dy;

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return { dx, dy };
  }

  /** Set virtual joystick movement vector (each axis in [-1, 1]). */
  setVirtualMovement(dx, dy) {
    this._virtualMove.dx = Math.max(-1, Math.min(1, dx ?? 0));
    this._virtualMove.dy = Math.max(-1, Math.min(1, dy ?? 0));
  }

  /** Set virtual aim vector. Use {0,0} to clear. */
  setVirtualAim(dx, dy) {
    this._virtualAim.dx = dx ?? 0;
    this._virtualAim.dy = dy ?? 0;
  }

  /** Return normalized virtual aim vector, or null when no override is active. */
  getAimOverride() {
    const dx = this._virtualAim.dx;
    const dy = this._virtualAim.dy;
    const len = Math.hypot(dx, dy);
    if (len < 0.0001) return null;
    return { dx: dx / len, dy: dy / len };
  }

  /** Hold or release the virtual primary (Space) input. */
  setVirtualPrimaryHeld(held) {
    this._virtualPrimaryHeld = !!held;
  }

  /** Trigger one-frame virtual skill press for KeyQ/KeyE/KeyR. */
  pressVirtualSkill(code) {
    if (code === 'KeyQ' || code === 'KeyE' || code === 'KeyR') {
      this._virtualSkillPress.add(code);
    }
  }

  /** Remove event listeners. Must be called when the engine is destroyed. */
  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
