import { CharacterJournal } from './CharacterJournal.jsx';

export function MainMenu({
  onNewCharacter,
  onContinue,
  onMeta,
  onOptions,
  history,
  hasCharacters,
  mobileMode = false,
  mobileModeIsAuto = false,
  onToggleMobileMode,
}) {
  const modeLabel = mobileMode ? 'Mobile' : 'Desktop';

  return (
    <div className="overlay menu-overlay">
      <div className="menu-box">
        <h1 className="game-title">EXILE</h1>
        <p className="menu-subtitle">Action RPG</p>

        <div className="menu-mode-card">
          <div className="menu-mode-label">
            {mobileModeIsAuto ? `Auto-detected: ${modeLabel}` : `Current mode: ${modeLabel}`}
          </div>
          <button className="btn btn-secondary btn-mobile-toggle" onClick={onToggleMobileMode}>
            {mobileMode ? '⌨ SWITCH TO DESKTOP' : '📱 SWITCH TO MOBILE'}
          </button>
          <p className="menu-mode-note">
            {mobileModeIsAuto
              ? 'We picked a default for this device. If it feels wrong, tap once here before you start.'
              : 'This preference is saved for you, and you can flip it here anytime before jumping in.'}
          </p>
        </div>

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
        <div className="menu-controls">
          {mobileMode ? (
            <>
              <p>Touch controls enabled with mobile HUD and performance tuning.</p>
              <p>Left stick &mdash; Move &nbsp;&nbsp; Right buttons &mdash; Skills / Pause</p>
              <p>Use the switch above anytime if you'd rather play with desktop controls.</p>
            </>
          ) : (
            <>
              <p>WASD / Arrow Keys &mdash; Move</p>
              <p>Q / E / R &mdash; Active skills</p>
              <p>I &mdash; Inventory &nbsp;&nbsp; P &mdash; Passive tree &nbsp;&nbsp; C &mdash; Character Sheet</p>
              <p>Escape &mdash; Pause &nbsp;&nbsp; Use the switch above if you're on a phone or tablet.</p>
            </>
          )}
        </div>
      </div>
      <CharacterJournal history={history} />
    </div>
  );
}
