/**
 * CharacterSelect — Phase 7 character selection screen.
 *
 * Shows 3 character cards. Locked characters display their unlock hint.
 * Clicking an unlocked card calls onSelect(characterId).
 *
 * Props:
 *   unlocked   — Set<string> of unlocked character ids (from AchievementSystem.loadUnlocks())
 *   onSelect(id) — called when the player confirms a character
 *   onBack       — called when the player returns to the main menu
 */
import { useState } from 'react';
import { CHARACTERS } from '../game/data/characters.js';
import { AchievementSystem } from '../game/systems/AchievementSystem.js';

function StatRow({ label, value, max, color }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="char-stat-row">
      <span className="char-stat-label">{label}</span>
      <div className="char-stat-bar-bg">
        <div
          className="char-stat-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}

export function CharacterSelect({ unlocked, highScores = {}, onSelect, onBack }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div className="overlay char-select-overlay">
      <div className="char-select-box">

        <div className="char-select-header">
          <button className="btn char-back-btn" onClick={onBack}>← Back</button>
          <h2 className="char-select-title">Choose Your Exile</h2>
          <div className="char-select-header-spacer" />
        </div>

        <div className="char-cards">
          {CHARACTERS.map((char) => {
            const isUnlocked = unlocked.has(char.id);
            const isHovered  = hovered === char.id;

            return (
              <div
                key={char.id}
                className={[
                  'char-card',
                  isUnlocked  ? 'char-card--unlocked'  : 'char-card--locked',
                  isHovered && isUnlocked ? 'char-card--hovered' : '',
                ].join(' ')}
                style={{ '--char-color': char.color }}
                onMouseEnter={() => setHovered(char.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => isUnlocked && onSelect(char.id)}
                role="button"
                aria-label={isUnlocked ? `Play as ${char.name}` : `${char.name} — ${char.unlockHint}`}
              >
                {/* Lock overlay for locked characters */}
                {!isUnlocked && (
                  <div className="char-card-lock">
                    <span className="char-lock-icon">🔒</span>
                    <span className="char-lock-hint">{char.unlockHint}</span>
                  </div>
                )}

                {/* Card body */}
                <div className="char-card-icon" style={{ color: char.color }}>
                  {char.icon}
                </div>

                <div className="char-card-name" style={{ color: char.color }}>
                  {char.name}
                </div>
                <div className="char-card-tagline">{char.tagline}</div>
                <div className="char-card-lore">{char.lore}</div>

                {/* Stats */}
                <div className="char-card-stats">
                  <StatRow label="Life"   value={char.baseStats.maxHealth} max={200} color="#4ecca3" />
                  <StatRow label="Speed"  value={char.baseStats.speed}     max={280} color="#f39c12" />
                </div>

                {/* Starting weapon */}
                <div className="char-card-weapon">
                  <span className="char-weapon-label">Starting Weapon</span>
                  <span className="char-weapon-name">
                    {char.startingWeapon.replace(/_/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                </div>

                {/* Unique bonus */}
                <div className="char-card-bonus">
                  {char.bonusStats.xpMultiplier    && `+${Math.round((char.bonusStats.xpMultiplier - 1) * 100)}% Experience`}
                  {char.bonusStats.pickupRadiusFlat && `+${char.bonusStats.pickupRadiusFlat} Pickup Radius`}
                  {char.bonusStats.healthRegenPerS  && `+${char.bonusStats.healthRegenPerS} HP/s Regeneration`}
                </div>

                {/* Tree region tag */}
                <div className="char-card-tree-region">
                  <span>Tree start: </span>
                  <span style={{ color: char.color }}>
                    {char.id === 'sage'    && 'Power Cluster'}
                    {char.id === 'rogue'   && 'Speed Cluster'}
                    {char.id === 'warrior' && 'Tank Cluster'}
                  </span>
                </div>

                {isUnlocked && (
                  <button className="btn btn-primary char-select-btn">
                    Select
                  </button>
                )}

                {/* High scores for this character */}
                {isUnlocked && highScores[char.id]?.length > 0 && (
                  <div className="char-high-scores">
                    <div className="char-hs-title">Best Runs</div>
                    {highScores[char.id].slice(0, 3).map((run, i) => (
                      <div key={i} className="char-hs-row">
                        <span className="char-hs-rank">#{i + 1}</span>
                        <span className="char-hs-time">{formatTime(run.elapsed)}</span>
                        <span className="char-hs-kills">{run.kills}k</span>
                        <span className="char-hs-lvl">Lv{run.level}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="char-select-footer">
          Press [P] in-game to open the passive skill tree &mdash; each character starts near their specialization.
        </p>
      </div>
    </div>
  );
}

/**
 * Small helper used in App.jsx: load current unlocks from localStorage
 * without needing a game engine instance.
 */
export { AchievementSystem };
