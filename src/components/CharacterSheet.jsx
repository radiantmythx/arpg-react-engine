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

function fmtModValue(operation, value) {
  if (operation === 'multiply') {
    return `\u00d7${+value.toFixed(3)}`;
  }
  const sign = value >= 0 ? '+' : '';
  const formatted = Number.isInteger(value) ? value : +value.toFixed(2);
  return `${sign}${formatted}`;
}

function fmtBonusValue(entry) {
  if (!entry) return '0';
  if (entry.mode === 'multiply') {
    const pct = (entry.value - 1) * 100;
    const pctText = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    return `\u00d7${entry.value.toFixed(3)} (${pctText})`;
  }
  const sign = entry.value >= 0 ? '+' : '';
  const value = Number.isInteger(entry.value) ? entry.value : entry.value.toFixed(2);
  return `${sign}${value}`;
}

function fmtStat(key, value) {
  const map = {
    damageMult:       (v) => `+${Math.round((v - 1) * 100)}% damage`,
    cooldownMult:     (v) => `${Math.round((v - 1) * 100)}% cooldown length`,
    maxHealthFlat:    (v) => `+${v} max life`,
    maxManaFlat:      (v) => `+${v} max mana`,
    healthRegenPerS:  (v) => `+${v} life regen/s`,
    manaRegenPerS:    (v) => `+${v} mana regen/s`,
    manaCostMult:     (v) => `${Math.round((v - 1) * 100)}% mana costs`,
    xpMultiplier:     (v) => `+${Math.round((v - 1) * 100)}% XP gain`,
    speedFlat:        (v) => `+${v} move speed`,
    pickupRadiusFlat: (v) => `+${v} pickup radius`,
    meleeStrikeRange: (v) => `+${Math.round(v * 100)}% melee strike range`,
    armorFlat:        (v) => `+${v} armor`,
    evasionFlat:      (v) => `+${v} evasion`,
    energyShieldFlat: (v) => `+${v} energy shield`,
    increasedDamageWithSword: (v) => `+${Math.round(v * 100)}% damage with swords`,
    increasedDamageWithAxe: (v) => `+${Math.round(v * 100)}% damage with axes`,
    increasedDamageWithBow: (v) => `+${Math.round(v * 100)}% damage with bows`,
    increasedDamageWithLance: (v) => `+${Math.round(v * 100)}% damage with lances`,
    increasedDamageWithWand: (v) => `+${Math.round(v * 100)}% damage with wands`,
    increasedDamageWithTome: (v) => `+${Math.round(v * 100)}% damage with tomes`,
    increasedDamageWithAttackSkills: (v) => `+${Math.round(v * 100)}% attack skill damage`,
    increasedDamageWithSpellSkills: (v) => `+${Math.round(v * 100)}% spell skill damage`,
    increasedDamageWithBowSkills: (v) => `+${Math.round(v * 100)}% bow skill damage`,
    increasedAttackSpeedWithBow: (v) => `+${Math.round(v * 100)}% attack speed with bows`,
    increasedAttackSpeedWithWand: (v) => `+${Math.round(v * 100)}% attack speed with wands`,
    increasedAttackSpeedWithAttackSkills: (v) => `+${Math.round(v * 100)}% attack skill speed`,
    increasedCastSpeedWithSpellSkills: (v) => `+${Math.round(v * 100)}% spell cast speed`,
  };
  return map[key] ? map[key](value) : `${key}: ${value}`;
}

function fmtAffixLabel(affix, fallbackKind = null) {
  if (!affix) return '';
  const tags = [];
  const affixKind = affix.kind ?? fallbackKind;
  if (affixKind === 'implicit') {
    tags.push('Implicit');
  } else if (affix.type) {
    tags.push(`${affix.type[0].toUpperCase()}${affix.type.slice(1)}`);
  }
  if (affix.tier != null) {
    tags.push(`T${affix.tier}`);
  }
  return tags.length > 0 ? `${affix.label ?? affix.id} (${tags.join(' · ')})` : (affix.label ?? affix.id);
}

/**
 * CharacterSheet — C10 hub-accessible stat summary.
 */
export function CharacterSheet({ hud, characterName = '', onClose, mobileMode = false, mode = 'sheet', feedback = '', craftingActions = [], onCraftAction = null }) {
  const [mobileSection, setMobileSection] = useState('summary');
  const [selectedGearSlot, setSelectedGearSlot] = useState(null);

  const {
    level = 1,
    health = 0,
    maxHealth = 0,
    mana = 0,
    maxMana = 0,
    energyShield = 0,
    maxEnergyShield = 0,
    kills = 0,
    mapEnemiesKilled = 0,
    mapEnemiesTotal = 0,
    mapMods = [],
    equipment = {},
    debugMode = false,
    modifierDebug = null,
    bonusDebug = null,
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
    const hasCurrent = selectedGearSlot && gearEntries.some(([slot]) => slot === selectedGearSlot);
    if (hasCurrent) return;

    const firstFilled = gearEntries.find(([, item]) => !!item)?.[0] ?? gearEntries[0]?.[0] ?? null;
    setSelectedGearSlot(firstFilled);
  }, [selectedGearSlot, gearEntries]);

  const selectedGearItem = selectedGearSlot ? (equipment?.[selectedGearSlot] ?? null) : null;
  const selectedGearStats = selectedGearItem
    ? Object.entries(selectedGearItem.baseStats ?? {}).filter(([k]) => k !== 'mapItemLevel')
    : [];
  const selectedGearImplicitAffixes = selectedGearItem?.implicitAffixes
    ?? (selectedGearItem?.affixes ?? []).filter((a) => (a?.kind ?? 'explicit') === 'implicit');
  const selectedGearExplicitAffixes = selectedGearItem?.explicitAffixes
    ?? (selectedGearItem?.affixes ?? []).filter((a) => (a?.kind ?? 'explicit') !== 'implicit');
  const craftingMode = mode === 'crafting';

  function renderGearDetail() {
    if (!selectedGearItem) {
      return <p className="cs-empty">Nothing equipped in this slot.</p>;
    }

    return (
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

        {selectedGearImplicitAffixes.length > 0 && (
          <div className="cs-gear-detail-section">
            <div className="cs-gear-detail-label">Implicit</div>
            <ul className="cs-gear-detail-list cs-gear-detail-list--affixes">
              {selectedGearImplicitAffixes.map((affix, i) => (
                <li key={`${affix.id ?? 'implicit'}-${i}`}>{fmtAffixLabel(affix, 'implicit')}</li>
              ))}
            </ul>
          </div>
        )}

        {selectedGearExplicitAffixes.length > 0 && (
          <div className="cs-gear-detail-section">
            <div className="cs-gear-detail-label">Affixes</div>
            <ul className="cs-gear-detail-list cs-gear-detail-list--affixes">
              {selectedGearExplicitAffixes.map((affix, i) => (
                <li key={`${affix.id ?? 'affix'}-${i}`}>{fmtAffixLabel(affix)}</li>
              ))}
            </ul>
          </div>
        )}

        {craftingMode && (
          <div className="cs-crafting-panel">
            <div className="cs-gear-detail-label">Crafting Bench</div>
            <div className="cs-crafting-actions">
              {craftingActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="cs-crafting-btn"
                  onClick={() => onCraftAction?.(selectedGearSlot, action.id)}
                >
                  <span className="cs-crafting-btn-label">{action.label}</span>
                  <span className="cs-crafting-btn-desc">{action.description}</span>
                </button>
              ))}
            </div>
            <div className="cs-crafting-feedback">{feedback || 'Select an item and apply a crafting action. Blocked actions explain why they failed.'}</div>
          </div>
        )}
      </>
    );
  }

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
                  <div className="cs-row"><span>Mana</span><strong>{Math.ceil(mana)} / {Math.round(maxMana)}</strong></div>
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
                      {renderGearDetail()}
                    </div>
                  </div>
                ) : (
                  <div className="cs-gear-desktop">
                    <div className="cs-eq-list">
                    {gearEntries.map(([slot, item]) => (
                      <button
                        type="button"
                        key={slot}
                        className={`cs-eq-row cs-eq-row--button${selectedGearSlot === slot ? ' cs-eq-row--active' : ''}`}
                        onClick={() => setSelectedGearSlot(slot)}
                      >
                        <span>{SLOT_LABELS[slot] ?? slot}</span>
                        <strong>{item?.name ?? 'Empty'}</strong>
                      </button>
                    ))}
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
                      {renderGearDetail()}
                    </div>
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

                {debugMode ? (
                  <>
                    <h3 style={{ marginTop: '1rem' }}>Modifier Debug</h3>
                    {!modifierDebug || modifierDebug.activeSourceCount === 0 ? (
                      <p className="cs-empty">No active modifier sources.</p>
                    ) : (
                      <div className="cs-mod-debug">
                        <div className="cs-mod-debug-summary">
                          {modifierDebug.activeSourceCount} active source{modifierDebug.activeSourceCount === 1 ? '' : 's'}
                          {' \u2014 '}
                          {modifierDebug.statBreakdown.length} stat{modifierDebug.statBreakdown.length === 1 ? '' : 's'} modified
                        </div>
                        {modifierDebug.sourceGroups?.length > 0 && (
                          <div className="cs-mod-debug-groups">
                            {modifierDebug.sourceGroups.map((group) => (
                              <div key={group.sourceKind} className="cs-mod-debug-group">
                                <div className="cs-mod-debug-group-header">
                                  <span className="cs-mod-debug-group-title">{group.label}</span>
                                  <span className="cs-mod-debug-group-count">{group.sourceCount}</span>
                                </div>
                                {group.sources.map((source, index) => (
                                  <div key={`${group.sourceKind}-${source.sourceLabel}-${index}`} className="cs-mod-debug-source">
                                    <span className="cs-mod-debug-source-label">{source.sourceLabel}</span>
                                    <span className="cs-mod-debug-stat-count">{source.entryCount} stat{source.entryCount === 1 ? '' : 's'}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                        {modifierDebug.statBreakdown.map((entry) => (
                          <div key={entry.statKey} className="cs-mod-debug-stat">
                            <div className="cs-mod-debug-stat-header">
                              <span className="cs-mod-debug-stat-name">{entry.statKey}</span>
                              <span className="cs-mod-debug-stat-count">{entry.sourceCount}&times;</span>
                            </div>
                            {entry.sources.map((src, i) => (
                              <div key={`${src.sourceLabel}-${i}`} className="cs-mod-debug-source">
                                <span className="cs-mod-debug-source-label">{src.sourceLabel}</span>
                                <span className={`cs-mod-debug-source-value cs-mod-debug-source-value--${src.operation}`}>
                                  {fmtModValue(src.operation, src.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    <h3 style={{ marginTop: '1rem' }}>Active Bonuses</h3>
                    {!bonusDebug || bonusDebug.bonusCount === 0 ? (
                      <p className="cs-empty">No active bonuses.</p>
                    ) : (
                      <div className="cs-mod-debug">
                        <div className="cs-mod-debug-summary">
                          {bonusDebug.bonusCount} active bonus{bonusDebug.bonusCount === 1 ? '' : 'es'}
                        </div>
                        {bonusDebug.bonuses.map((entry) => (
                          <div key={entry.statKey} className="cs-mod-debug-source cs-mod-debug-source--bonus">
                            <span className="cs-mod-debug-stat-name">{entry.statKey}</span>
                            <span className={`cs-mod-debug-source-value cs-mod-debug-source-value--${entry.mode}`}>
                              {fmtBonusValue(entry)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="cs-empty" style={{ marginTop: '1rem' }}>Developer Mode hidden. Press F3 to view bonus diagnostics.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
