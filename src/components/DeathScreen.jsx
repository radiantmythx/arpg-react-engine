import '../styles/DeathScreen.css';

/**
 * DeathScreen — C2 portal death overlay.
 *
 * Shown when the player dies but has portals remaining.
 * Displaying portals remaining and a "Return to Hub" button.
 *
 * Props:
 *   portalsLeft  {number}    — portals still available (0+ ; 0 should not reach here)
 *   stats        {object}    — { elapsed, kills, level }
 *   onReturnHub  {function}  — called when the player clicks "Return to Hub"
 */
export function DeathScreen({ portalsLeft = 0, stats = {}, onReturnHub }) {
  const { elapsed = 0, kills = 0, level = 1, characterName = '', characterClass = '', mapName = '' } = stats;

  const totalPortals = 3;
  const usedPortals  = totalPortals - portalsLeft;

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="ds-overlay">
      <div className="ds-box">
        <div className="ds-skull">💀</div>
        <h2 className="ds-title">YOU DIED</h2>

        {(characterName || characterClass) && (
          <div className="ds-charline">
            <span className="ds-charname">{characterName || 'Unknown'}</span>
            {characterClass ? <span className="ds-charclass">{characterClass}</span> : null}
            {mapName ? <span className="ds-charclass">{mapName}</span> : null}
          </div>
        )}

        <div className="ds-portals-label">Portals Remaining</div>
        <div className="ds-portals">
          {Array.from({ length: totalPortals }, (_, i) => (
            <span
              key={i}
              className={`ds-portal-pip ${i < portalsLeft ? 'ds-portal-pip--active' : 'ds-portal-pip--used'}`}
            />
          ))}
        </div>

        <div className="ds-stats">
          <div className="ds-stat">
            <span className="ds-stat-label">Level</span>
            <span className="ds-stat-value">{level}</span>
          </div>
          <div className="ds-stat">
            <span className="ds-stat-label">Kills</span>
            <span className="ds-stat-value">{kills}</span>
          </div>
          <div className="ds-stat">
            <span className="ds-stat-label">Time</span>
            <span className="ds-stat-value">{fmt(elapsed)}</span>
          </div>
        </div>

        <p className="ds-hint">
          {portalsLeft > 0
            ? `You may re-enter the map — ${portalsLeft} portal${portalsLeft !== 1 ? 's' : ''} left.`
            : 'All portals have been spent. The map is lost.'}
        </p>

        <button className="btn btn-primary ds-btn" onClick={onReturnHub}>
          Return to Hub
        </button>
      </div>
    </div>
  );
}
