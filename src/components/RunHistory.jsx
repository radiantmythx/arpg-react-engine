/**
 * RunHistory — compact table of last 10 runs, newest first.
 *
 * Props:
 *   history — RunRecord[] from MetaProgression.loadHistory()
 */

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function RunHistory({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="run-history">
        <h3 className="run-history-title">Recent Runs</h3>
        <p className="run-history-empty">No runs yet — start a game to record your first run!</p>
      </div>
    );
  }

  return (
    <div className="run-history">
      <h3 className="run-history-title">Recent Runs</h3>
      <table className="run-history-table">
        <thead>
          <tr>
            <th>Character</th>
            <th>Time</th>
            <th>Lvl</th>
            <th>Kills</th>
            <th>Bosses</th>
            <th>Shards</th>
          </tr>
        </thead>
        <tbody>
          {history.map((run, idx) => (
            <tr key={idx} className="run-history-row">
              <td className="run-char">{run.characterName}</td>
              <td className="run-time">{formatTime(run.elapsed)}</td>
              <td className="run-level">{run.level}</td>
              <td className="run-kills">{run.kills}</td>
              <td className="run-bosses">{run.bossesDefeated}</td>
              <td className="run-shards">◆ {run.shardsEarned}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
