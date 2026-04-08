import { useEffect, useMemo, useState } from 'react';
import '../styles/CharacterSheet.css';

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

const SLOT_ORDER = ['helmet', 'mainhand', 'offhand', 'bodyarmor', 'amulet', 'ring1', 'ring2', 'gloves', 'belt', 'boots'];

const SLOT_LABELS = {
  helmet: 'Helmet',
  mainhand: 'Main Hand',
  offhand: 'Off Hand',
  bodyarmor: 'Body',
  amulet: 'Amulet',
  ring1: 'Ring L',
  ring2: 'Ring R',
  gloves: 'Gloves',
  belt: 'Belt',
  boots: 'Boots',
};

const RARITY_LABELS = {
  normal: 'Normal',
  magic: 'Magic',
  rare: 'Rare',
  unique: 'Unique',
};

const RARITY_CLASS = {
  normal: 'normal',
  magic: 'magic',
  rare: 'rare',
  unique: 'unique',
};

function fmtStat(key, value) {
  const map = {
    damageMult:       (v) => `+${Math.round((v - 1) * 100)}% weapon damage`,
    cooldownMult:     (v) => `${Math.round((v - 1) * 100)}% weapon cooldown`,
    maxHealthFlat:    (v) => `+${v} max life`,
    healthRegenPerS:  (v) => `+${v} life regen/s`,
    xpMultiplier:     (v) => `+${Math.round((v - 1) * 100)}% XP gain`,
    speedFlat:        (v) => `+${v} move speed`,
    pickupRadiusFlat: (v) => `+${v} pickup radius`,
    armorFlat:        (v) => `+${v} armor`,
    evasionFlat:      (v) => `+${v} evasion`,
    energyShieldFlat: (v) => `+${v} energy shield`,
  };
  return map[key] ? map[key](value) : `${key}: ${value}`;
}

/**
 * CharacterSheet — C10 hub-accessible stat summary.
 */
export function CharacterSheet({ hud, characterName = '', onClose, mobileMode = false }) {
  const [mobileSection, setMobileSection] = useState('summary');
  const [selectedGearSlot, setSelectedGearSlot] = useState(null);

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

  const gearEntries = useMemo(() => {
    const ordered = SLOT_ORDER
      .filter((slot) => Object.prototype.hasOwnProperty.call(equipment ?? {}, slot))
      .map((slot) => [slot, equipment?.[slot] ?? null]);
    const extra = Object.entries(equipment ?? {}).filter(([slot]) => !SLOT_ORDER.includes(slot));
    return [...ordered, ...extra];
  }, [equipment]);

  useEffect(() => {
    if (!mobileMode) return;
    if (mobileSection !== 'gear') return;

    const hasCurrent = selectedGearSlot && gearEntries.some(([slot]) => slot === selectedGearSlot);
    if (hasCurrent) return;

    const firstFilled = gearEntries.find(([, item]) => !!item)?.[0] ?? gearEntries[0]?.[0] ?? null;
    setSelectedGearSlot(firstFilled);
  }, [mobileMode, mobileSection, selectedGearSlot, gearEntries]);

  const selectedGearItem = selectedGearSlot ? (equipment?.[selectedGearSlot] ?? null) : null;
  const selectedGearStats = selectedGearItem
    ? Object.entries(selectedGearItem.baseStats ?? {}).filter(([k]) => k !== 'mapTier' && k !== 'mapItemLevel')
    : [];
  const selectedGearAffixes = selectedGearItem?.affixes ?? [];

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
                {mobileMode ? (
                  <div className="cs-gear-mobile">
                    <div className="cs-gear-chip-grid">
                      {gearEntries.map(([slot, item]) => {
                        const isSelected = selectedGearSlot === slot;
                        const rarityClass = item ? ` cs-gear-chip--${RARITY_CLASS[item.rarity] ?? 'normal'}` : '';
                        return (
                          <button
                            key={slot}
                            type="button"
                            className={`cs-gear-chip${isSelected ? ' cs-gear-chip--active' : ''}${item ? ' cs-gear-chip--filled' : ''}${rarityClass}`}
                            onClick={() => setSelectedGearSlot(slot)}
                          >
                            <span className="cs-gear-chip-slot">{SLOT_LABELS[slot] ?? slot}</span>
                            <span className="cs-gear-chip-name">{item?.name ?? 'Empty'}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="cs-gear-detail">
                      <div className="cs-gear-detail-header">
                        <span className="cs-gear-detail-slot">{SLOT_LABELS[selectedGearSlot] ?? selectedGearSlot ?? 'Gear'}</span>
                        {selectedGearItem && (
                          <span className={`cs-gear-detail-rarity cs-gear-detail-rarity--${RARITY_CLASS[selectedGearItem.rarity] ?? 'normal'}`}>
                            {RARITY_LABELS[selectedGearItem.rarity] ?? 'Item'}
                          </span>
                        )}
                      </div>

                      {selectedGearItem ? (
                        <>
                          <div className={`cs-gear-detail-name cs-gear-detail-name--${RARITY_CLASS[selectedGearItem.rarity] ?? 'normal'}`}>
                            {selectedGearItem.name}
                          </div>
                          {selectedGearItem.description && (
                            <p className="cs-gear-detail-desc">{selectedGearItem.description}</p>
                          )}

                          {selectedGearStats.length > 0 && (
                            <div className="cs-gear-detail-section">
                              <div className="cs-gear-detail-label">Stats</div>
                              <ul className="cs-gear-detail-list">
                                {selectedGearStats.map(([key, value]) => (
                                  <li key={key}>{fmtStat(key, value)}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {selectedGearAffixes.length > 0 && (
                            <div className="cs-gear-detail-section">
                              <div className="cs-gear-detail-label">Affixes</div>
                              <ul className="cs-gear-detail-list cs-gear-detail-list--affixes">
                                {selectedGearAffixes.map((affix, i) => (
                                  <li key={`${affix.id ?? 'affix'}-${i}`}>{affix.label ?? affix.id}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="cs-empty">Nothing equipped in this slot.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="cs-eq-list">
                    {gearEntries.map(([slot, item]) => (
                      <div key={slot} className="cs-eq-row">
                        <span>{SLOT_LABELS[slot] ?? slot}</span>
                        <strong>{item?.name ?? 'Empty'}</strong>
                      </div>
                    ))}
                  </div>
                )}
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
