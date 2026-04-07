/**
 * CharacterCreateScreen — C1
 *
 * Lets the player name their new character and pick a class.
 * On "Create", generates a UUID, writes the initial save via CharacterSave,
 * and calls onCreate(characterId, charDef).
 *
 * Props:
 *   onCreate(characterId, charDef)  — called after the save is written
 *   onBack()                        — go back (to MainMenu or CharacterSelect)
 */
import { useState } from 'react';
import { CHARACTERS } from '../game/data/characters.js';
import { CharacterSave } from '../game/CharacterSave.js';
import '../styles/CharacterCreate.css';

const MAX_NAME_LEN = 24;

// ── Stat bar helper ───────────────────────────────────────────────────────────

function StatBar({ label, value, max = 10, color }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="cc-stat-row">
      <span className="cc-stat-label">{label}</span>
      <div className="cc-stat-bar-bg">
        <div className="cc-stat-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// Rough stat scores for display (out of 10)
const CLASS_STATS = {
  sage:    { hp: 3, speed: 5, damage: 9, defence: 2 },
  rogue:   { hp: 2, speed: 9, damage: 6, defence: 3 },
  warrior: { hp: 9, speed: 2, damage: 5, defence: 8 },
};

// ── Main component ────────────────────────────────────────────────────────────

export function CharacterCreateScreen({ onCreate, onBack }) {
  const [name,       setName]       = useState('');
  const [selectedId, setSelectedId] = useState('sage');
  const [error,      setError]      = useState('');

  const selectedChar = CHARACTERS.find((c) => c.id === selectedId);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a character name.');
      return;
    }
    if (trimmed.length > MAX_NAME_LEN) {
      setError(`Name must be ${MAX_NAME_LEN} characters or fewer.`);
      return;
    }

    const id = crypto.randomUUID();
    const charDef = CHARACTERS.find((c) => c.id === selectedId);
    const initialData = CharacterSave.createInitial(id, trimmed, charDef);
    CharacterSave.save(id, initialData);
    onCreate(id, charDef);
  };

  const handleNameChange = (e) => {
    setName(e.target.value.slice(0, MAX_NAME_LEN));
    if (error) setError('');
  };

  return (
    <div className="overlay cc-overlay">
      <div className="cc-box">

        {/* Header */}
        <div className="cc-header">
          <button className="btn cc-back-btn" onClick={onBack}>← Back</button>
          <h2 className="cc-title">Create Character</h2>
          <div className="cc-header-spacer" />
        </div>

        {/* Name input */}
        <div className="cc-section cc-section--name">
          <label className="cc-label" htmlFor="char-name">Character Name</label>
          <input
            id="char-name"
            className={['cc-name-input', error ? 'cc-name-input--error' : ''].join(' ')}
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="Enter a name…"
            maxLength={MAX_NAME_LEN}
            autoFocus
            autoComplete="off"
          />
          <div className="cc-name-meta">
            {error
              ? <span className="cc-error">{error}</span>
              : <span className="cc-char-count">{name.length} / {MAX_NAME_LEN}</span>
            }
          </div>
        </div>

        {/* Class picker */}
        <div className="cc-section">
          <div className="cc-label">Choose Class</div>
          <div className="cc-class-cards">
            {CHARACTERS.map((char) => {
              const isSelected = char.id === selectedId;
              const stats = CLASS_STATS[char.id] ?? { hp: 5, speed: 5, damage: 5, defence: 5 };

              return (
                <button
                  key={char.id}
                  className={['cc-class-card', isSelected ? 'cc-class-card--selected' : ''].join(' ')}
                  style={{ '--char-color': char.color }}
                  onClick={() => setSelectedId(char.id)}
                  type="button"
                >
                  <div className="cc-class-icon">{char.icon}</div>
                  <div className="cc-class-name" style={{ color: char.color }}>{char.name}</div>
                  <div className="cc-class-tagline">{char.tagline}</div>
                  {isSelected && (
                    <div className="cc-class-stats">
                      <StatBar label="Life"    value={stats.hp}     color="#e17055" />
                      <StatBar label="Speed"   value={stats.speed}  color="#74b9ff" />
                      <StatBar label="Damage"  value={stats.damage} color="#fdcb6e" />
                      <StatBar label="Defence" value={stats.defence} color="#55efc4" />
                    </div>
                  )}
                  {isSelected && (
                    <p className="cc-class-lore">{char.lore}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Create button */}
        <div className="cc-footer">
          <button
            className="btn btn-primary cc-create-btn"
            onClick={handleCreate}
            disabled={!name.trim()}
          >
            Create Character
          </button>
        </div>

      </div>
    </div>
  );
}
