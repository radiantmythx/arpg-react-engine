/**
 * AudioManager
 * Procedurally synthesised sound effects using the Web Audio API.
 * No audio files are loaded — every sound is generated from oscillators and
 * noise buffers with ADSR-like gain envelopes.
 *
 * Usage:
 *   const audio = new AudioManager();
 *   audio.play('fire');
 *   audio.play('hit');
 *   audio.play('enemy_death');
 *   audio.play('xp_collect');
 *   audio.play('level_up');
 *   audio.play('player_hurt');
 *
 * The AudioContext is created lazily on the first play() call to avoid the
 * "AudioContext was not allowed to start" browser policy restriction.
 */
export class AudioManager {
  /** localStorage key used to persist master volume across sessions. */
  static STORAGE_KEY = 'survivor_volume';

  constructor() {
    /** @type {AudioContext | null} */
    this._ctx = null;
    this.muted = false;
    /** Master volume: 0.0 – 1.0. Loaded from localStorage on construction. */
    this.volume = AudioManager._loadVolume();
  }

  /** Read persisted volume (default 1.0 if never set). */
  static _loadVolume() {
    const v = parseFloat(localStorage.getItem(AudioManager.STORAGE_KEY));
    return isNaN(v) ? 1.0 : Math.max(0, Math.min(1, v));
  }

  /**
   * Set master volume (0–1) and persist to localStorage.
   * @param {number} v — clamped to [0, 1]
   */
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    localStorage.setItem(AudioManager.STORAGE_KEY, String(this.volume));
    if (this._masterGain) this._masterGain.gain.value = this.volume;
  }

  /** Ensure the AudioContext exists and is running. */
  _getCtx() {
    if (!this._ctx) {
      this._ctx = new AudioContext();
      // Master gain node — all sounds route through this so setVolume() affects everything
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this.volume;
      this._masterGain.connect(this._ctx.destination);
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    return this._ctx;
  }

  /**
   * Play a named sound effect.
   * Safe to call before any user interaction — will silently fail if AudioContext
   * cannot start yet, and the lazy-init will retry on the next call.
   * @param {'fire'|'hit'|'enemy_death'|'xp_collect'|'level_up'|'player_hurt'} name
   */
  play(name) {
    if (this.muted) return;
    try {
      const ctx = this._getCtx();
      switch (name) {
        case 'fire':        this._playFire(ctx);        break;
        case 'hit':         this._playHit(ctx);         break;
        case 'enemy_death': this._playEnemyDeath(ctx);  break;
        case 'xp_collect':  this._playXpCollect(ctx);   break;
        case 'level_up':    this._playLevelUp(ctx);     break;
        case 'player_hurt': this._playPlayerHurt(ctx);  break;
      }
    } catch {
      // Silently ignore — audio is purely cosmetic.
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Connect osc → gain → masterGain → destination and schedule a quick release. */
  _fire(ctx, osc, gainNode, attackTime, sustainTime, releaseTime) {
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.35, now + attackTime);
    gainNode.gain.setValueAtTime(0.35, now + attackTime + sustainTime);
    gainNode.gain.linearRampToValueAtTime(0, now + attackTime + sustainTime + releaseTime);
    osc.connect(gainNode);
    gainNode.connect(this._masterGain);
    osc.start(now);
    osc.stop(now + attackTime + sustainTime + releaseTime + 0.01);
  }

  /** Create a buffer of white noise. */
  _noiseBuffer(ctx, duration) {
    const sampleRate = ctx.sampleRate;
    const buffer     = ctx.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate);
    const data       = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // ─── Sound Definitions ──────────────────────────────────────────────────────

  /** Short bright blip — weapon fire. */
  _playFire(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.005);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }

  /** Crisp impact — projectile hits enemy. */
  _playHit(ctx) {
    // Short noise burst filtered to mid-freq.
    const src    = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain   = ctx.createGain();
    src.buffer    = this._noiseBuffer(ctx, 0.08);
    filter.type   = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value         = 2.5;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.07);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterGain);
    src.start(ctx.currentTime);
  }

  /** Low thud + high crack — enemy dies. */
  _playEnemyDeath(ctx) {
    const now = ctx.currentTime;

    // Low thud (sine sweep down)
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.18);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.22);
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start(now);
    osc.stop(now + 0.23);

    // Short high crack (noise)
    const src    = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g2     = ctx.createGain();
    src.buffer   = this._noiseBuffer(ctx, 0.05);
    filter.type  = 'highpass';
    filter.frequency.value = 3000;
    g2.gain.setValueAtTime(0.3, now);
    g2.gain.linearRampToValueAtTime(0, now + 0.05);
    src.connect(filter);
    filter.connect(g2);
    g2.connect(this._masterGain);
    src.start(now);
  }

  /** Bright ping — XP gem collected. */
  _playXpCollect(ctx) {
    const now  = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1047, now);           // C6
    osc.frequency.setValueAtTime(1319, now + 0.03);   // E6
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.14);
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /** Ascending arpeggio — level up. */
  _playLevelUp(ctx) {
    const now    = ctx.currentTime;
    const notes  = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const t    = now + i * 0.085;
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
      gain.gain.setValueAtTime(0.3, t + 0.09);
      gain.gain.linearRampToValueAtTime(0, t + 0.22);
      osc.connect(gain);
      gain.connect(this._masterGain);
      osc.start(t);
      osc.stop(t + 0.23);
    });
  }

  /** Low, dissonant buzz — player takes damage. */
  _playPlayerHurt(ctx) {
    const now  = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.18);
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}
