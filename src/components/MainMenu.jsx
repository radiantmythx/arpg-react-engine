export function MainMenu({
  onNewCharacter,
  onContinue,
  onOptions,
  hasCharacters,
  mobileMode = false,
  mobileModeIsAuto = false,
  onToggleMobileMode,
}) {
  const modeLabel = mobileMode ? 'Mobile' : 'Desktop';
  const handlePlay = hasCharacters ? onContinue : onNewCharacter;

  return (
    <div className="overlay menu-overlay">
      <div className="menu-box">
        <h1 className="game-title">LONER</h1>
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

        <button className="btn btn-primary" onClick={handlePlay}>
          ▶ PLAY
        </button>
        <button className="btn btn-secondary" onClick={onOptions}>
          ⚙ OPTIONS
        </button>
      </div>
    </div>
  );
}
