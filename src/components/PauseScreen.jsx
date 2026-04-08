export function PauseScreen({ onResume, onOptions, onAbandon, onMainMenu, hubMode = false }) {
  return (
    <div className="overlay pause-overlay">
      <div className="pause-box">
        <h2 className="pause-title">{hubMode ? 'MENU' : 'PAUSED'}</h2>
        <button className="btn btn-primary" onClick={onResume}>
          {hubMode ? 'BACK TO HUB' : 'RESUME'}
        </button>
        <button className="btn btn-secondary" onClick={onOptions}>
          ⚙ OPTIONS
        </button>
        {hubMode ? (
          <button className="btn btn-danger" onClick={onMainMenu}>
            RETURN TO MAIN MENU
          </button>
        ) : (
          <button className="btn btn-danger" onClick={onAbandon}>
            ABANDON RUN
          </button>
        )}
        <p className="pause-hint">{hubMode ? 'Press Escape to return' : 'Press Escape to resume'}</p>
      </div>
    </div>
  );
}
