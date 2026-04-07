import '../styles/MapCompleteScreen.css';

function fmt(seconds = 0) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * C6 map-complete overlay after boss kill.
 */
export function MapCompleteScreen({ stats = {}, onReturnHub, onStay }) {
  return (
    <div className="mcs-overlay">
      <div className="mcs-box">
        <div className="mcs-mark">✦</div>
        <h2 className="mcs-title">Map Cleared</h2>
        <div className="mcs-name">{stats.mapName ?? 'Unknown Map'}</div>
        {stats.bossName ? <div className="mcs-boss">Boss Slain: {stats.bossName}</div> : null}

        <div className="mcs-grid">
          <div className="mcs-cell"><span>Tier</span><strong>{stats.tier ?? 1}</strong></div>
          <div className="mcs-cell"><span>Level</span><strong>{stats.level ?? 1}</strong></div>
          <div className="mcs-cell"><span>Kills</span><strong>{stats.kills ?? 0}</strong></div>
          <div className="mcs-cell"><span>Time</span><strong>{fmt(stats.elapsed ?? 0)}</strong></div>
          <div className="mcs-cell"><span>Cleared</span><strong>{stats.enemiesKilled ?? 0}/{stats.enemiesTotal ?? 0}</strong></div>
          <div className="mcs-cell"><span>Portals</span><strong>{stats.portalsLeft ?? 0}/3</strong></div>
        </div>

        <p className="mcs-note">Loot has dropped in the arena. You can keep looting or exit to hub.</p>

        <div className="mcs-actions">
          <button className="btn btn-secondary mcs-btn" onClick={onStay}>Stay</button>
          <button className="btn btn-primary mcs-btn" onClick={onReturnHub}>Exit to Hub</button>
        </div>
      </div>
    </div>
  );
}
