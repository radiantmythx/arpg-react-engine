import { useMemo, useState } from 'react';
import { listFreeMaps } from '../game/content/registries/index.js';
import '../styles/MapSelect.css';

const FREE_MAPS = listFreeMaps();

/**
 * C3 minimal map select opened from the hub map device.
 */
export function MapSelectScreen({
  onSelectMap,
  onClose,
  activeMap = null,
  onResumeMap,
  actsCleared = [],
  mapItems = [],
  onOpenMapPortal,
  primedPortal = null,
  mobileMode = false,
}) {
  const [tab, setTab] = useState('acts');
  const [socketedUid, setSocketedUid] = useState(null);

  const clearSet = useMemo(() => new Set(actsCleared), [actsCleared]);

  const rows = useMemo(() => {
    return FREE_MAPS.map((map) => {
      const unlocked = !map.unlockReq || clearSet.has(map.unlockReq);
      const cleared = clearSet.has(map.id);
      return { ...map, unlocked, cleared };
    });
  }, [clearSet]);

  const selectedMapItem = useMemo(
    () => mapItems.find((item) => item.uid === socketedUid) ?? null,
    [mapItems, socketedUid],
  );

  return (
    <div className="mapsel-overlay">
      <div className="mapsel-panel">
        <div className="mapsel-header">
          <h2>Map Device</h2>
          <button className="mapsel-close" onClick={onClose}>Back</button>
        </div>

        <div className="mapsel-tabs">
          <button
            className={`mapsel-tab ${tab === 'acts' ? 'mapsel-tab--active' : ''}`}
            onClick={() => setTab('acts')}
          >
            Acts
          </button>
          <button
            className={`mapsel-tab ${tab === 'device' ? 'mapsel-tab--active' : ''}`}
            onClick={() => setTab('device')}
          >
            Map Device
          </button>
        </div>

        <p className="mapsel-subtitle">{tab === 'acts'
          ? (mobileMode ? 'Tap a destination to travel there instantly.' : 'Choose a free act map')
          : (mobileMode ? 'Tap a map item below, then press Open Portal.' : 'Socket a map item and open a hub portal')}
        </p>

        {activeMap ? (
          <button className="mapsel-row mapsel-row--active" onClick={onResumeMap}>
            <span className="mapsel-name">Resume: {activeMap.name}</span>
            <span className="mapsel-tier">{activeMap.portalsRemaining}/3 portals</span>
            <span className="mapsel-desc">Re-enter your current instance at the start room.</span>
          </button>
        ) : null}

        {tab === 'acts' ? (
          <div className="mapsel-list">
            {rows.map((map) => (
              <button
                key={map.id}
                className={`mapsel-row ${!map.unlocked ? 'mapsel-row--locked' : ''}`}
                onClick={() => map.unlocked && onSelectMap(map)}
                disabled={!map.unlocked}
              >
                <span className="mapsel-name">
                  {map.cleared ? '✔ ' : ''}
                  {map.name}
                </span>
                <span className="mapsel-tier">T{map.tier}</span>
                <span className="mapsel-desc">
                  {map.unlocked
                    ? map.description
                    : `Locked: clear ${FREE_MAPS.find((m) => m.id === map.unlockReq)?.name ?? map.unlockReq}`}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mapsel-device-layout">
            <div className="mapsel-device-card">
              <div className="mapsel-device-title">Socketed Map</div>
              {selectedMapItem ? (
                <>
                  <div className="mapsel-device-item mapsel-device-item--active">
                    <span className="mapsel-name">{selectedMapItem.name}</span>
                    <span className="mapsel-tier">T{selectedMapItem.mapTier ?? 1}</span>
                    <span className="mapsel-desc">
                      Theme: {selectedMapItem.mapTheme ?? 'unknown'} · iLvl {selectedMapItem.mapItemLevel ?? 1}
                    </span>
                  </div>
                  <button
                    className="mapsel-open-btn"
                    onClick={() => selectedMapItem && onOpenMapPortal?.(selectedMapItem.uid)}
                  >
                    Open Portal (Consumes Map)
                  </button>
                </>
              ) : (
                <div className="mapsel-device-placeholder">
                  Select a map item from your inventory list.
                </div>
              )}

              {primedPortal ? (
                <div className="mapsel-primed-note">
                  Portal primed for <strong>{primedPortal.name}</strong> (T{primedPortal.tier}). Return to hub and press F near the portal to enter.
                </div>
              ) : null}
            </div>

            <div className="mapsel-device-card">
              <div className="mapsel-device-title">Inventory Map Items</div>
              {mapItems.length === 0 ? (
                <div className="mapsel-device-placeholder">
                  No map items available. Map items drop from enemies in act maps.
                </div>
              ) : (
                <div className="mapsel-list">
                  {mapItems.map((item) => (
                    <button
                      key={item.uid}
                      className={`mapsel-row ${socketedUid === item.uid ? 'mapsel-row--socketed' : ''}`}
                      onClick={() => setSocketedUid(item.uid)}
                    >
                      <span className="mapsel-name">{item.name}</span>
                      <span className="mapsel-tier">T{item.mapTier ?? 1}</span>
                      <span className="mapsel-desc">
                        {item.mapMods?.length ?? 0} mods · {item.rarity?.toUpperCase() ?? 'MAGIC'} · Theme: {item.mapTheme ?? 'unknown'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
