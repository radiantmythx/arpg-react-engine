import { useState } from 'react';
import '../styles/CharacterSheet.css';

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

/**
 * CharacterSheet — C10 hub-accessible stat summary.
 */
export function CharacterSheet({ hud, characterName = '', onClose, mobileMode = false }) {
  const [mobileSection, setMobileSection] = useState('summary');

  const {
    level = 1,
    health = 0,
    maxHealth = 0,
    energyShield = 0,
    maxEnergyShield = 0,
    kills = 0,
    mapEnemiesKilled = 0,
    mapEnemiesTotal = 0,
    mapMods = [],
    equipment = {},
  } = hud ?? {};

  const equippedCount = Object.values(equipment ?? {}).filter(Boolean).length;
  const showSummary = !mobileMode || mobileSection === 'summary';
  const showGear = !mobileMode || mobileSection === 'gear';
  const showMods = !mobileMode || mobileSection === 'mods';

  return (
    <div className="cs-overlay">
      <div className="cs-panel phone-shell-panel">
        <div className="cs-header phone-shell-header">
          <div>
            <h2>Character Sheet</h2>
            <p>{characterName || 'Unknown Exile'}</p>
          </div>
          <button className="cs-close" onClick={onClose}>{mobileMode ? 'Done' : 'Close'}</button>
        </div>

        {mobileMode && (
          <>
            <div className="cs-mobile-tabs">
              <button type="button" className={`cs-mobile-tab${mobileSection === 'summary' ? ' cs-mobile-tab--active' : ''}`} onClick={() => setMobileSection('summary')}>Summary</button>
              <button type="button" className={`cs-mobile-tab${mobileSection === 'gear' ? ' cs-mobile-tab--active' : ''}`} onClick={() => setMobileSection('gear')}>Gear</button>
              <button type="button" className={`cs-mobile-tab${mobileSection === 'mods' ? ' cs-mobile-tab--active' : ''}`} onClick={() => setMobileSection('mods')}>Mods</button>
            </div>
            <div className="cs-mobile-hint">
              {mobileSection === 'summary'
                ? 'Quickly check your core defenses and run progress here.'
                : mobileSection === 'gear'
                  ? 'Your equipped items are grouped here for easier portrait browsing.'
                  : 'Active map modifiers are collected here so they are easier to scan on phones.'}
            </div>
          </>
        )}

        <div className={`cs-content${mobileMode ? ' phone-shell-scroll' : ''}`}>
          <div className="cs-grid">
            {showSummary && (
              <>
                <div className="cs-card">
                  <h3>Defenses</h3>
                  <div className="cs-row"><span>Level</span><strong>{level}</strong></div>
                  <div className="cs-row"><span>Life</span><strong>{Math.ceil(health)} / {maxHealth}</strong></div>
                  <div className="cs-row"><span>Energy Shield</span><strong>{Math.ceil(energyShield)} / {Math.round(maxEnergyShield)}</strong></div>
                  <div className="cs-row"><span>Estimated Life %</span><strong>{maxHealth > 0 ? pct(health / maxHealth) : '0%'}</strong></div>
                </div>

                <div className="cs-card">
                  <h3>Progress</h3>
                  <div className="cs-row"><span>Total Kills</span><strong>{kills}</strong></div>
                  <div className="cs-row"><span>Map Clear Count</span><strong>{mapEnemiesKilled}/{mapEnemiesTotal}</strong></div>
                  <div className="cs-row"><span>Equipped Slots</span><strong>{equippedCount}</strong></div>
                  <div className="cs-row"><span>Active Map Mods</span><strong>{mapMods.length}</strong></div>
                </div>
              </>
            )}

            {showGear && (
              <div className="cs-card cs-card--wide">
                <h3>Equipment</h3>
                <div className="cs-eq-list">
                  {Object.entries(equipment ?? {}).map(([slot, item]) => (
                    <div key={slot} className="cs-eq-row">
                      <span>{slot}</span>
                      <strong>{item?.name ?? 'Empty'}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showMods && (
              <div className="cs-card cs-card--wide">
                <h3>Map Modifiers</h3>
                {mapMods.length === 0 ? (
                  <p className="cs-empty">No active modifiers.</p>
                ) : (
                  <div className="cs-mods">
                    {mapMods.map((mod) => (
                      <div key={mod.id} className="cs-mod-row">
                        <span className={`cs-mod-type cs-mod-type--${mod.type ?? 'special'}`}>{(mod.type ?? 'special').toUpperCase()}</span>
                        <strong>{mod.label ?? mod.id}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
