function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function RunTimeline({ events, elapsed }) {
  if (!events || events.length === 0 || elapsed <= 0) return null;
  return (
    <div className="run-timeline">
      <div className="run-timeline-label">RUN TIMELINE</div>
      <div className="run-timeline-track">
        {events.map((ev, i) => {
          const pct = Math.min(100, (ev.time / elapsed) * 100);
          return (
            <div
              key={i}
              className={`run-timeline-marker run-timeline-marker--${ev.type}`}
              style={{ left: `${pct}%` }}
              title={ev.type === 'boss' ? `Boss: ${ev.name}` : `Level ${ev.level}`}
            />
          );
        })}
      </div>
      <div className="run-timeline-ends">
        <span>0:00</span>
        <span>{formatTime(elapsed)}</span>
      </div>
    </div>
  );
}

export function GameOver({ stats, onRestart }) {
  const bossesDefeated = stats?.bossesDefeated ?? [];
  return (
    <div className="overlay game-over-overlay">
      <div className="game-over-box">
        <h2 className="game-over-title">YOU DIED</h2>
        <div className="final-stats">
          <div className="final-stat">
            <span>Survived</span>
            <span>{formatTime(stats?.elapsed ?? 0)}</span>
          </div>
          <div className="final-stat">
            <span>Kills</span>
            <span>{stats?.kills ?? 0}</span>
          </div>
          <div className="final-stat">
            <span>Level reached</span>
            <span>{stats?.level ?? 1}</span>
          </div>
          <div className="final-stat">
            <span>Bosses defeated</span>
            <span>{bossesDefeated.length}</span>
          </div>
          {(stats?.shardsThisRun ?? 0) > 0 && (
            <div className="final-stat final-stat--shards">
              <span>◆ Shards earned</span>
              <span className="shard-earned">{stats.shardsThisRun}</span>
            </div>
          )}
          {stats?.totalShards != null && (
            <div className="final-stat final-stat--shards">
              <span>◆ Total shards</span>
              <span className="shard-total">{stats.totalShards}</span>
            </div>
          )}
        </div>
        {bossesDefeated.length > 0 && (
          <div className="boss-kills-list">
            {bossesDefeated.map((name, i) => (
              <div key={i} className="boss-kills-item">⚔ {name}</div>
            ))}
          </div>
        )}
        <RunTimeline events={stats?.runEventLog} elapsed={stats?.elapsed ?? 0} />
        <button className="btn btn-primary" onClick={onRestart}>
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
}
