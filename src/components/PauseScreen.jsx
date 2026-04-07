export function PauseScreen({ onResume, onOptions, onAbandon }) {
  return (
    <div className="overlay pause-overlay">
      <div className="pause-box">
        <h2 className="pause-title">PAUSED</h2>
        <button className="btn btn-primary" onClick={onResume}>
          RESUME
        </button>
        <button className="btn btn-secondary" onClick={onOptions}>
          ⚙ OPTIONS
        </button>
        <button className="btn btn-danger" onClick={onAbandon}>
          ABANDON RUN
        </button>
        <p className="pause-hint">Press Escape to resume</p>
      </div>
    </div>
  );
}
