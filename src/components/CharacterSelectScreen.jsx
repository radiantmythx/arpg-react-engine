/**
 * CharacterSelectScreen — C1
 *
 * Lists all saved characters. Clicking one selects it (onSelect).
 * "New Character" opens the create flow (onNew).
 * Each card has a delete button with inline confirmation.
 *
 * Props:
 *   onSelect(characterId, charDef)  — called when the player clicks a saved character
 *   onNew()                         — navigate to CharacterCreateScreen
 *   onBack()                        — go back to MainMenu (optional escape hatch)
 */
import { useState } from 'react';
import { CharacterSave } from '../game/CharacterSave.js';
import { CHARACTER_MAP } from '../game/data/characters.js';
import '../styles/CharacterSelectScreen.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function ClassBadge({ classId }) {
  const def = CHARACTER_MAP[classId];
  if (!def) return <span className="cs-class-badge">?</span>;
  return (
    <span
      className="cs-class-badge"
      style={{ color: def.color, borderColor: def.color + '44' }}
      title={def.name}
    >
      {def.icon}
    </span>
  );
}

// ── Individual character card ─────────────────────────────────────────────────

function CharacterCard({ summary, onSelect, onDelete }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const def = CHARACTER_MAP[summary.class] ?? {};

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setConfirmingDelete(true);
  };

  const handleConfirmDelete = (e) => {
    e.stopPropagation();
    onDelete(summary.id);
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setConfirmingDelete(false);
  };

  return (
    <div
      className="cs-card"
      style={{ '--char-color': def.color ?? '#f9ca24' }}
      onClick={() => !confirmingDelete && onSelect(summary.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && !confirmingDelete && onSelect(summary.id)}
    >
      <ClassBadge classId={summary.class} />

      <div className="cs-card-info">
        <div className="cs-card-name">{summary.name}</div>
        <div className="cs-card-meta">
          <span className="cs-card-class">{def.name ?? summary.class}</span>
          <span className="cs-card-sep">·</span>
          <span className="cs-card-level">Level {summary.level ?? 1}</span>
        </div>
        <div className="cs-card-date">Last played {formatDate(summary.lastPlayed)}</div>
      </div>

      <div className="cs-card-actions" onClick={(e) => e.stopPropagation()}>
        {confirmingDelete ? (
          <div className="cs-delete-confirm">
            <span className="cs-delete-confirm-text">Delete?</span>
            <button className="btn cs-confirm-yes" onClick={handleConfirmDelete}>Yes</button>
            <button className="btn cs-confirm-no"  onClick={handleCancelDelete}>No</button>
          </div>
        ) : (
          <button
            className="btn cs-delete-btn"
            title="Delete character"
            onClick={handleDeleteClick}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CharacterSelectScreen({ onSelect, onNew, onBack }) {
  const [characters, setCharacters] = useState(() => CharacterSave.list());

  const handleSelect = (characterId) => {
    const save = CharacterSave.load(characterId);
    if (!save) return;
    const charDef = CHARACTER_MAP[save.class];
    onSelect(characterId, charDef ?? CHARACTER_MAP['sage']);
  };

  const handleDelete = (characterId) => {
    CharacterSave.delete(characterId);
    setCharacters(CharacterSave.list());
    // If all characters deleted, surface the empty state
  };

  const isEmpty = characters.length === 0;

  return (
    <div className="overlay cs-overlay">
      <div className="cs-box">

        {/* Header */}
        <div className="cs-header">
          <button className="btn cs-back-btn" onClick={onBack}>← Menu</button>
          <h2 className="cs-title">Select Character</h2>
          <button className="btn btn-primary cs-new-btn" onClick={onNew}>
            + New Character
          </button>
        </div>

        {/* Character list */}
        <div className="cs-list">
          {isEmpty ? (
            <div className="cs-empty">
              <p>No characters yet.</p>
              <button className="btn btn-primary" onClick={onNew}>
                Create Your First Character
              </button>
            </div>
          ) : (
            characters.map((summary) => (
              <CharacterCard
                key={summary.id}
                summary={summary}
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>

      </div>
    </div>
  );
}
