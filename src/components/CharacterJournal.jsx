import { CharacterSave } from '../game/CharacterSave.js';

function fmtHours(seconds = 0) {
  return `${(seconds / 3600).toFixed(1)}h`;
}

function fmtStamp(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function sumElapsedByCharacter(history = []) {
  const totals = new Map();
  for (const run of history) {
    const id = run?.characterId;
    if (!id) continue;
    totals.set(id, (totals.get(id) ?? 0) + (run.elapsed ?? 0));
  }
  return totals;
}

/**
 * CharacterJournal — C10 replacement for RunHistory.
 * Shows per-character long-term progression at a glance.
 */
export function CharacterJournal({ history = [] }) {
  const chars = CharacterSave.list();
  const elapsedByChar = sumElapsedByCharacter(history);

  if (chars.length === 0) {
    return (
      <div className="run-history">
        <h3 className="run-history-title">Character Journal</h3>
        <p className="run-history-empty">No characters found yet.</p>
      </div>
    );
  }

  return (
    <div className="run-history">
      <h3 className="run-history-title">Character Journal</h3>
      <table className="run-history-table">
        <thead>
          <tr>
            <th>Character</th>
            <th>Acts</th>
            <th>Maps</th>
            <th>Bosses</th>
            <th>Last Clear</th>
            <th>Played</th>
          </tr>
        </thead>
        <tbody>
          {chars.map((entry) => {
            const full = CharacterSave.load(entry.id) ?? {};
            const acts = full.actsCleared?.length ?? 0;
            const maps = full.mapsCleared ?? 0;
            const bosses = full.bossesKilled?.length ?? 0;
            const played = elapsedByChar.get(entry.id) ?? 0;
            const clearStamps = Object.values(full.actsClearedAt ?? {}).filter(Boolean).sort();
            const lastClear = clearStamps.length ? clearStamps[clearStamps.length - 1] : null;
            return (
              <tr key={entry.id} className="run-history-row">
                <td className="run-char">{entry.name}</td>
                <td className="run-level">{acts}</td>
                <td className="run-kills">{maps}</td>
                <td className="run-bosses">{bosses}</td>
                <td className="run-clear-stamp">{fmtStamp(lastClear)}</td>
                <td className="run-time">{fmtHours(played)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
