import '../styles/HubScreen.css';

/**
 * HubScreen (C3)
 * Lightweight overlay shown while the player is in the hub world.
 */
export function HubScreen({ characterName, nearbyInteractable, onSwitchCharacter, mobileMode = false, compactMode = false }) {
  return (
    <>
      <div className="hub-topbar">
        {!mobileMode && (
          <div className="hub-topbar-left">
            <span className="hub-topbar-label">Hub</span>
            {characterName ? <span className="hub-topbar-char">{characterName}</span> : null}
          </div>
        )}
        <button className="hub-switch-btn" onClick={onSwitchCharacter}>{compactMode ? 'Switch' : 'Switch Character'}</button>
      </div>

      {!mobileMode && nearbyInteractable ? (
        <div className="hub-interact-prompt">
          <span className="hub-interact-label">
            {nearbyInteractable.label} - Click to {nearbyInteractable.id === 'map_portal' ? 'Enter' : 'Open'}
          </span>
        </div>
      ) : null}
    </>
  );
}
