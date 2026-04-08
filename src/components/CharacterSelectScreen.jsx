/**
 * CharacterSelectScreen — C1
 *
 * Lists all saved characters. Clicking one selects it (onSelect).
 * "New Character" opens the create flow (onNew).
 * Each card has a delete button with inline confirmation.
 * Each card has a journal button that shows stats for that character.
 *
 * Props:
 *   onSelect(characterId, charDef)  — called when the player clicks a saved character
 *   onNew()                         — navigate to CharacterCreateScreen
 *   onBack()                        — go back to MainMenu (optional escape hatch)
 *   history                         — run history array from MetaProgression
 */
import { useState, useMemo } from 'react';
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

function fmtHours(seconds = 0) {
  const h = seconds / 3600;
  return h < 0.1 ? '<0.1h' : `${h.toFixed(1)}h`;
}

function fmtStamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

// ── Journal modal ─────────────────────────────────────────────────────────────

function JournalModal({ characterId, history = [], onClose }) {
  const save = useMemo(() => CharacterSave.load(characterId) ?? {}, [characterId]);
  const def = CHARACTER_MAP[save.class] ?? {};

  const acts = save.actsCleared?.length ?? 0;
  const maps = save.mapsCleared ?? 0;
  const bosses = (save.bossesKilled?.length ?? 0);
  const clearStamps = Object.values(save.actsClearedAt ?? {}).filter(Boolean).sort();
  const lastClear = clearStamps.length ? clearStamps[clearStamps.length - 1] : null;

  const playedSeconds = useMemo(() => {
    return history.filter((r) => r?.characterId === characterId).reduce((sum, r) => sum + (r.elapsed ?? 0), 0);
  }, [history, characterId]);

  const recentRuns = useMemo(() => {
    return history
      .filter((r) => r?.characterId === characterId)
      .slice(-5)
      .reverse();
  }, [history, characterId]);

  return (
    <div className="cs-journal-backdrop" onClick={onClose}>
      <div className="cs-journal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cs-journal-header">
          <span className="cs-journal-icon">{def.icon ?? '?'}</span>
          <div className="cs-journal-title-block">
            <span className="cs-journal-name">{save.name}</span>
            <span className="cs-journal-class">{def.name ?? save.class} · Level {save.level ?? 1}</span>
          </div>
          <button className="cs-journal-close" onClick={onClose}>✕</button>
        </div>

        <div className="cs-journal-stats">
          <div className="cs-journal-stat"><span className="cs-js-label">Acts Cleared</span><span className="cs-js-val">{acts}</span></div>
          <div className="cs-journal-stat"><span className="cs-js-label">Maps Cleared</span><span className="cs-js-val">{maps}</span></div>
          <div className="cs-journal-stat"><span className="cs-js-label">Bosses Killed</span><span className="cs-js-val">{bosses}</span></div>
          <div className="cs-journal-stat"><span className="cs-js-label">Time Played</span><span className="cs-js-val">{fmtHours(playedSeconds)}</span></div>
          <div className="cs-journal-stat"><span className="cs-js-label">Last Clear</span><span className="cs-js-val">{fmtStamp(lastClear)}</span></div>
          <div className="cs-journal-stat"><span className="cs-js-label">Skill Points</span><span className="cs-js-val">{save.skillPoints ?? 0}</span></div>
        </div>

        {recentRuns.length > 0 && (
          <div className="cs-journal-runs">
            <div className="cs-journal-runs-title">Recent Runs</div>
            {recentRuns.map((run, i) => (
              <div key={i} className="cs-journal-run-row">
                <span className="cs-jr-map">{run.mapName ?? 'Unknown map'}</span>
                <span className="cs-jr-kills">{run.kills ?? 0} kills</span>
                <span className="cs-jr-time">{fmtHours(run.elapsed ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Individual character card ─────────────────────────────────────────────────

function CharacterCard({ summary, onSelect, onDelete, onJournal }) {
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
        <button
          className="btn cs-journal-btn"
          title="Character journal"
          onClick={(e) => { e.stopPropagation(); onJournal(summary.id); }}
        >
          📖
        </button>
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

export function CharacterSelectScreen({ onSelect, onNew, onBack, history = [] }) {
  const [characters, setCharacters] = useState(() => CharacterSave.list());
  const [journalId, setJournalId] = useState(null);

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
                onJournal={setJournalId}
              />
            ))
          )}
        </div>

      </div>

      {journalId && (
        <JournalModal
          characterId={journalId}
          history={history}
          onClose={() => setJournalId(null)}
        />
      )}
    </div>
  );
}
