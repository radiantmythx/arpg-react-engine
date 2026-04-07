import { CharacterJournal } from './CharacterJournal.jsx';

export function MainMenu({
  onNewCharacter,
  onContinue,
  onMeta,
  onOptions,
  history,
  hasCharacters,
  mobileMode = false,
  onToggleMobileMode,
}) {
  return (
    <div className="overlay menu-overlay">
      <div className="menu-box">
        <h1 className="game-title">EXILE</h1>
        <p className="menu-subtitle">Action RPG</p>
        {hasCharacters ? (
          <>
            <button className="btn btn-primary" onClick={onContinue}>
              ▶ CONTINUE
            </button>
            <button className="btn btn-secondary" onClick={onNewCharacter}>
              + NEW CHARACTER
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={onNewCharacter}>
            CREATE CHARACTER
          </button>
        )}
        <button className="btn btn-secondary" onClick={onOptions}>
          ⚙ OPTIONS
        </button>
        <button className="btn btn-meta" onClick={onMeta}>
          ◆ META PROGRESSION
        </button>
        <button className="btn btn-secondary btn-mobile-toggle" onClick={onToggleMobileMode}>
          {mobileMode ? '📱 MOBILE MODE: ON' : '⌨ DESKTOP MODE: ON'}
        </button>
        <div className="menu-controls">
          {mobileMode ? (
            <>
              <p>Mobile mode enabled: on-screen controls coming in staged rollout.</p>
              <p>Current build: use mobile keyboard/gamepad as a temporary fallback.</p>
            </>
          ) : (
            <>
              <p>WASD / Arrow Keys &mdash; Move</p>
              <p>Q / E / R &mdash; Active skills</p>
              <p>I &mdash; Inventory &nbsp;&nbsp; P &mdash; Passive tree &nbsp;&nbsp; C &mdash; Character Sheet</p>
              <p>Escape &mdash; Pause</p>
            </>
          )}
        </div>
      </div>
      <CharacterJournal history={history} />
    </div>
  );
}
