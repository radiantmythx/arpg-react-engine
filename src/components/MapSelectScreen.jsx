import { useMemo, useState } from 'react';
import { listFreeMaps } from '../game/content/registries/index.js';
import '../styles/MapSelect.css';

const FREE_MAPS = listFreeMaps();

function toRoman(value = 1) {
  const map = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
  return map[value] ?? `${value}`;
}

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

  const actGroups = useMemo(() => {
    const byAct = new Map();
    for (const map of rows) {
      const actNumber = Number(map.act ?? 1);
      const partNumber = Number(map.campaignPart ?? 1);
      if (!byAct.has(actNumber)) byAct.set(actNumber, []);
      byAct.get(actNumber).push({
        ...map,
        partNumber,
        partLabel: `Part ${toRoman(partNumber)}`,
      });
    }

    return [...byAct.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([act, parts]) => ({
        act,
        parts: [...parts].sort((a, b) => a.partNumber - b.partNumber),
      }));
  }, [rows]);

  const selectedMapItem = useMemo(
    () => mapItems.find((item) => item.uid === socketedUid) ?? null,
    [mapItems, socketedUid],
  );

  const mobileSummary = tab === 'acts'
    ? 'Choose an unlocked act and tap it once to travel there immediately.'
    : selectedMapItem
      ? `Ready: ${selectedMapItem.name}. Tap Open Portal to consume it and prime the hub portal.`
      : 'Step 1: choose a map item below. Step 2: tap Open Portal once it is selected.';

  return (
    <div className="mapsel-overlay">
      <div className="mapsel-panel phone-shell-panel">
        <div className="mapsel-header phone-shell-header">
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

        <div className="mapsel-scroll phone-shell-scroll">
          <p className="mapsel-subtitle">{tab === 'acts'
            ? (mobileMode ? 'Tap a destination to travel there instantly.' : 'Choose a free act map')
            : (mobileMode ? 'Tap a map item below, then press Open Portal.' : 'Socket a map item and open a hub portal')}
          </p>

          {mobileMode && (
            <div className="mapsel-mobile-summary">
              <div className="mapsel-mobile-step">{tab === 'acts' ? 'Act Travel' : selectedMapItem ? 'Step 2 · Open the portal' : 'Step 1 · Select a map item'}</div>
              <div className="mapsel-mobile-copy">{mobileSummary}</div>
              {tab === 'device' && selectedMapItem && (
                <button
                  className="mapsel-open-btn mapsel-open-btn--mobile"
                  onClick={() => onOpenMapPortal?.(selectedMapItem.uid)}
                >
                  Open Portal (Consumes Map)
                </button>
              )}
            </div>
          )}

          {activeMap ? (
            <button className="mapsel-row mapsel-row--active" onClick={onResumeMap}>
              <span className="mapsel-name">Resume: {activeMap.name}</span>
              <span className="mapsel-tier">{activeMap.portalsRemaining}/3 portals</span>
              <span className="mapsel-desc">Re-enter your current instance at the start room.</span>
            </button>
          ) : null}

          {tab === 'acts' ? (
            <div className="mapsel-act-groups">
              {actGroups.map((group) => (
                <section key={group.act} className="mapsel-act-group">
                  <div className="mapsel-act-header">
                    <span className="mapsel-act-title">Act {toRoman(group.act)}</span>
                    <span className="mapsel-act-subtitle">Select a sub-area</span>
                  </div>
                  <div className="mapsel-part-grid">
                    {group.parts.map((map) => (
                      <button
                        key={map.id}
                        className={`mapsel-part-btn ${map.unlocked ? '' : 'mapsel-part-btn--locked'} ${map.cleared ? 'mapsel-part-btn--cleared' : ''}`}
                        onClick={() => map.unlocked && onSelectMap(map)}
                        disabled={!map.unlocked}
                        title={map.unlocked
                          ? `${map.name} (Area Lv. ${map.areaLevel ?? '?'})`
                          : `Locked: clear ${FREE_MAPS.find((m) => m.id === map.unlockReq)?.name ?? map.unlockReq}`}
                      >
                        <span className="mapsel-part-label">{map.partLabel}</span>
                        <span className="mapsel-part-level">Lv. {map.areaLevel ?? '?'}</span>
                        <span className="mapsel-part-name">{map.name.replace(/^Act\s+[IVX]+\s+-\s+Part\s+[IVX]+:\s+/, '')}</span>
                      </button>
                    ))}
                  </div>
                </section>
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
                      <span className="mapsel-tier">iLvl {selectedMapItem.mapItemLevel ?? 1}</span>
                      <span className="mapsel-desc">
                        Theme: {selectedMapItem.mapTheme ?? 'unknown'} · iLvl {selectedMapItem.mapItemLevel ?? 1}
                      </span>
                    </div>
                    {!mobileMode && (
                      <button
                        className="mapsel-open-btn"
                        onClick={() => selectedMapItem && onOpenMapPortal?.(selectedMapItem.uid)}
                      >
                        Open Portal (Consumes Map)
                      </button>
                    )}
                  </>
                ) : (
                  <div className="mapsel-device-placeholder">
                    Select a map item from your inventory list.
                  </div>
                )}

                {primedPortal ? (
                  <div className="mapsel-primed-note">
                    Portal primed for <strong>{primedPortal.name}</strong> (Lv.{primedPortal.areaLevel ?? 1}). Return to hub and press F near the portal to enter.
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
                        <span className="mapsel-tier">iLvl {item.mapItemLevel ?? 1}</span>
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
    </div>
  );
}
