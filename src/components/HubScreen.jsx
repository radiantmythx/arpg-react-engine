import '../styles/HubScreen.css';

/**
 * HubScreen (C3)
 * Lightweight overlay shown while the player is in the hub world.
 */
export function HubScreen({ characterName, nearbyInteractable, onSwitchCharacter }) {
  return (
    <>
      <div className="hub-topbar">
        <div className="hub-topbar-left">
          <span className="hub-topbar-label">Hub</span>
          {characterName ? <span className="hub-topbar-char">{characterName}</span> : null}
        </div>
        <button className="hub-switch-btn" onClick={onSwitchCharacter}>Switch Character</button>
      </div>

      <div className="hub-help-strip">
        <span>Move: WASD</span>
        <span>Interact: Click</span>
        <span>Inventory: I</span>
        <span>Tree: P</span>
        <span>Vendor: V Spot</span>
        <span>Sheet: C</span>
      </div>

      {nearbyInteractable ? (
        <div className="hub-interact-prompt">
          <span className="hub-interact-label">
            {nearbyInteractable.label} - Click to {nearbyInteractable.id === 'map_portal' ? 'Enter' : 'Open'}
          </span>
        </div>
      ) : null}
    </>
  );
}
