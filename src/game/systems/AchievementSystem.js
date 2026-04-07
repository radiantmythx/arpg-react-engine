import { CHARACTER_MAP } from '../data/characters.js';

/**
 * AchievementSystem — checks in-run unlock conditions every game frame.
 *
 * When a condition is met for the first time:
 *   1. Saves the unlock to localStorage (persists across tabs/sessions).
 *   2. Fires the onUnlock(characterId) callback so the UI can show a toast.
 *
 * Only fires once per run per condition (tracked via _firedThisRun).
 * Checks are skipped for characters already in the persisted unlock set.
 */
export class AchievementSystem {
  /**
   * @param {import('../GameEngine.js').GameEngine} engine
   * @param {(characterId: string) => void} onUnlock  — called when a character is unlocked
   */
  constructor(engine, onUnlock) {
    this.engine        = engine;
    this.onUnlock      = onUnlock ?? (() => {});
    this._firedThisRun = new Set();
    this._unlocked     = AchievementSystem.loadUnlocks();
  }

  /**
   * Called once per game frame from GameEngine._update().
   * Iterates over characters with unlock conditions and checks them.
   */
  update() {
    const { elapsed, kills } = this.engine;

    for (const char of Object.values(CHARACTER_MAP)) {
      if (!char.unlockCondition)              continue; // always unlocked
      if (this._unlocked.has(char.id))        continue; // already earned
      if (this._firedThisRun.has(char.id))    continue; // already fired this run

      const { type, value } = char.unlockCondition;
      const met =
        (type === 'survive' && elapsed >= value) ||
        (type === 'kills'   && kills   >= value);

      if (met) {
        this._firedThisRun.add(char.id);
        this._unlocked.add(char.id);
        AchievementSystem.saveUnlocks(this._unlocked);
        this.onUnlock(char.id);
      }
    }
  }

  // ── Static helpers ────────────────────────────────────────────────────────

  /**
   * Returns a Set of unlocked character ids from localStorage.
   * Sage is always included regardless of stored data.
   */
  static loadUnlocks() {
    try {
      const raw = localStorage.getItem('survivor_unlocks');
      const arr = raw ? JSON.parse(raw) : [];
      const result = new Set(Array.isArray(arr) ? arr : []);
      result.add('sage'); // never losable
      return result;
    } catch {
      return new Set(['sage']);
    }
  }

  /** Persists a Set of unlocked ids to localStorage. */
  static saveUnlocks(unlockSet) {
    try {
      localStorage.setItem('survivor_unlocks', JSON.stringify([...unlockSet]));
    } catch {
      // Ignore write failures (private browsing / quota exceeded)
    }
  }
}
