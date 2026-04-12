/**
 * InventoryScreen — PoE/D2-style ARPG inventory overlay.
 *
 * Layout  (left panel = paper doll, right panel = 12×6 inventory grid):
 *
 *       ┌────────────────────┬──────────────────────────────┐
 *       │   [Helmet]         │                              │
 *       │ [Main] [Amulet] [Off]│   12 × 6 Inventory Grid   │
 *       │ [Ring1][Body][Ring2]│                              │
 *       │ [Gloves][Belt][Boots]│                             │
 *       └────────────────────┴──────────────────────────────┘
 *
 * Props:
 *   inventory         — { cols, rows, items[] }
 *   equipment         — 10-key map of serialized equip entries
 *   cursorItem        — itemDef held on the cursor, or null
 *   mousePos          — { x, y } viewport coords
 *   onClose           — called when [I] pressed / X clicked
 *   onItemClick(uid)
 *   onItemRightClick(uid)
 *   onCellClick(col, row)
 *   onSlotClick(slot)
 */
import { useEffect, useRef, useState } from 'react';
import { ItemTooltip } from './ItemTooltip.jsx';
import { GemPanel } from './GemPanel.jsx';

const CELL_SIZE = 46;
const LONG_PRESS_MS = 420;

function pulse(ms = 10) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  navigator.vibrate(ms);
}

// Icon glyphs per item slot/type — shown large inside the grid cell
const ITEM_ICON = {
  weapon:     '⚔',  mainhand:   '⚔',
  offhand:    '🗡',
  armor:      '🛡',  bodyarmor:  '🛡',
  helmet:     '⛑',
  boots:      '👢',
  gloves:     '🧤',  belt:       '🎗',
  ring:       '💍',  ring1:      '💍',  ring2:      '💍',
  amulet:     '📿',
  jewelry:    '💎',
  skill_gem:  '◇',
  support_gem:'◆',
  map_item:   '🗺',
  map:        '🗺',
};

function getItemIcon(item) {
  if (item.type === 'skill_gem')    return item.gemIcon ?? '◇';
  if (item.type === 'support_gem')  return item.gemIcon ?? '◆';
  if (item.type === 'map_item')     return '🗺';
  return ITEM_ICON[item.slot] ?? '⚙';
}

// Visual size of each equip slot tile (in grid-cell units)
const SLOT_CONFIG = {
  helmet:    { label: '⛑',  name: 'Helmet',    w: 2, h: 2 },
  mainhand:  { label: '⚔',  name: 'Main Hand', w: 2, h: 3 },
  offhand:   { label: '🗡',  name: 'Off Hand',  w: 2, h: 3 },
  bodyarmor: { label: '🛡',  name: 'Body',      w: 2, h: 3 },
  amulet:    { label: '📿',  name: 'Amulet',    w: 1, h: 1 },
  ring1:     { label: '💍',  name: 'Ring',       w: 1, h: 1 },
  ring2:     { label: '💍',  name: 'Ring',       w: 1, h: 1 },
  gloves:    { label: '🧤',  name: 'Gloves',    w: 2, h: 2 },
  belt:      { label: '🎗',  name: 'Belt',      w: 2, h: 1 },
  boots:     { label: '👢',  name: 'Boots',     w: 2, h: 2 },
};

const RARITY_COLORS = {
  normal: '#9e9e9e',
  magic:  '#6b9cd4',
  rare:   '#f1c40f',
  unique: '#c86400',
};

const EQUIPPABLE_SLOTS = new Set(['weapon', 'armor', 'jewelry', 'helmet', 'boots', 'offhand', 'ring', 'amulet', 'mainhand', 'bodyarmor', 'gloves', 'belt']);

// Slots that accept a given item.slot string
const SLOT_ACCEPTS = {
  mainhand:  ['mainhand', 'weapon'],
  offhand:   ['offhand'],
  bodyarmor: ['bodyarmor', 'armor'],
  helmet:    ['helmet'],
  boots:     ['boots'],
  belt:      ['belt'],
  ring1:     ['ring'],
  ring2:     ['ring'],
  amulet:    ['amulet', 'jewelry'],
  gloves:    ['gloves'],
};

function slotIsCompatible(slotKey, cursorItem) {
  if (!cursorItem) return false;
  return SLOT_ACCEPTS[slotKey]?.includes(cursorItem.slot) ?? false;
}

// ─── Single equip slot tile ───────────────────────────────────────────────────
function EquipSlotTile({ slotKey, entry, cursorItem, onSlotClick, mobileMode = false, tileSize = CELL_SIZE }) {
  const cfg      = SLOT_CONFIG[slotKey];
  const w        = cfg.w * tileSize;
  const h        = cfg.h * tileSize;
  const rarity   = entry?.rarity ?? 'normal';
  const isTarget = slotIsCompatible(slotKey, cursorItem);

  const activateSlot = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    pulse(8);
    onSlotClick(slotKey, true);
  };

  return (
    <div
      className={[
        'equip-slot-tile',
        entry  ? `item-rarity-${rarity}` : '',
        isTarget ? 'equip-slot-tile--target' : '',
      ].join(' ')}
      style={{
        width:       w,
        height:      h,
        borderColor: entry ? (RARITY_COLORS[rarity] ?? RARITY_COLORS.normal) : undefined,
      }}
      onClick={() => onSlotClick(slotKey, false)}
      onTouchEnd={mobileMode ? activateSlot : undefined}
      title={entry ? `${entry.name} (${cfg.name})` : `${cfg.name} (empty)`}
    >
      {entry ? (
        <>
          <span className="equip-tile-icon" style={{ color: RARITY_COLORS[rarity] }}>
            {cfg.label}
          </span>
          <span className="equip-tile-name" style={{ color: RARITY_COLORS[rarity] }}>
            {entry.name}
          </span>
        </>
      ) : (
        <span className="equip-tile-empty">
          {cfg.label}<br />{cfg.name}
        </span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function InventoryScreen({
  inventory,
  equipment,
  gold,
  feedback,
  cursorItem,
  mousePos,
  onClose,
  onItemClick,
  onItemRightClick,
  onDropItem,
  onCellClick,
  onSlotClick,
  // Gem tab props
  activeTab,
  onTabChange,
  primarySkill,
  activeSkills,
  onSocketGem,
  onUnsocketGem,
  onEquipSkillGem,
  onUnequipSkillGem,
  mobileMode = false,
}) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [hoveredGemTooltip, setHoveredGemTooltip] = useState(null);
  const [mobileSection, setMobileSection] = useState('bag');
  const [mobileGemStep, setMobileGemStep] = useState('supports');
  const [selectedSupportGemUid, setSelectedSupportGemUid] = useState(null);
  const [selectedSkillGemUid, setSelectedSkillGemUid] = useState(null);
  const [selectedMobileItemUid, setSelectedMobileItemUid] = useState(null);
  const touchTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const suppressClickUntilRef = useRef(0);
  const { cols, rows, items } = inventory;
  const tab = activeTab ?? 'equipment';
  const mobileViewport = typeof window !== 'undefined' ? window.innerWidth : 390;
  const cellSize = mobileMode
    ? Math.max(32, Math.min(40, Math.floor((mobileViewport - 54) / Math.max(cols, 1))))
    : CELL_SIZE;
  const tileSize = mobileMode ? Math.max(30, Math.min(38, cellSize + 2)) : CELL_SIZE;
  const showGearPanel = !mobileMode || mobileSection === 'gear';
  const showBagPanel = !mobileMode || mobileSection === 'bag';
  const isGemItem = (item) => item?.type === 'support_gem' || item?.type === 'skill_gem';
  const supportGemItems = items.filter((item) => item.type === 'support_gem');
  const skillGemItems = items.filter((item) => item.type === 'skill_gem');
  const selectedSupportGem = items.find((item) => item.uid === selectedSupportGemUid && item.type === 'support_gem') ?? null;
  const selectedSkillGem = items.find((item) => item.uid === selectedSkillGemUid && item.type === 'skill_gem') ?? null;
  const selectedMobileItem = items.find((item) => item.uid === selectedMobileItemUid) ?? null;
  const canQuickAction = !!selectedMobileItem && (selectedMobileItem.type === 'skill_gem' || EQUIPPABLE_SLOTS.has(selectedMobileItem.slot));
  const canManageInGems = !!selectedMobileItem && isGemItem(selectedMobileItem);
  const quickActionLabel = selectedMobileItem?.type === 'skill_gem' ? 'Open Gems' : 'Quick Equip';

  const handleGemTooltipHover = (itemData, evt) => {
    if (mobileMode || !itemData || !evt) return;
    setHoveredGemTooltip({
      itemData,
      mousePos: { x: evt.clientX, y: evt.clientY },
    });
  };

  const clearGemTooltipHover = () => {
    setHoveredGemTooltip(null);
  };

  const handleSlotActivation = (slot, fromTouch = false) => {
    if (fromTouch) suppressClickUntilRef.current = Date.now() + 300;
    if (suppressGhostClick()) return;
    onSlotClick(slot);
  };

  const clearTouchTimer = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const suppressGhostClick = () => Date.now() < suppressClickUntilRef.current;

  const startLongPress = (callback) => (e) => {
    if (!mobileMode) return;
    e.preventDefault();
    e.stopPropagation();
    longPressFiredRef.current = false;
    clearTouchTimer();
    touchTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      suppressClickUntilRef.current = Date.now() + 450;
      pulse(14);
      callback();
      touchTimerRef.current = null;
    }, LONG_PRESS_MS);
  };

  const finishTouchTap = (callback, hapticMs = 8) => (e) => {
    if (!mobileMode) return;
    e.preventDefault();
    e.stopPropagation();
    const hadPendingPress = !!touchTimerRef.current;
    clearTouchTimer();
    if (hadPendingPress && !longPressFiredRef.current) {
      suppressClickUntilRef.current = Date.now() + 300;
      pulse(hapticMs);
      callback();
    }
    longPressFiredRef.current = false;
  };

  const cancelTouchPress = () => {
    clearTouchTimer();
    longPressFiredRef.current = false;
  };

  useEffect(() => {
    if (!mobileMode) {
      setSelectedMobileItemUid(null);
      return;
    }
    if (cursorItem || tab !== 'equipment') {
      setSelectedMobileItemUid(null);
      return;
    }
    if (selectedMobileItemUid && !items.some((item) => item.uid === selectedMobileItemUid)) {
      setSelectedMobileItemUid(null);
    }
  }, [mobileMode, cursorItem, tab, items, selectedMobileItemUid]);

  const handleInventoryItemActivation = (itemUid, itemDef) => {
    if (!mobileMode && isGemItem(itemDef)) {
      setSelectedSupportGemUid(null);
      setSelectedSkillGemUid(null);
      onItemClick(itemUid);
      return;
    }

    if (mobileMode && tab === 'equipment' && !cursorItem) {
      setSelectedMobileItemUid((prev) => (prev === itemUid ? null : itemUid));
      return;
    }

    const targetTab = isGemItem(itemDef) ? 'gems' : 'equipment';
    onTabChange?.(targetTab);

    if (mobileMode && targetTab === 'equipment') {
      setMobileSection('bag');
    }

    // Support gems use selection mode for socketing from any tab.
    if (itemDef?.type === 'support_gem') {
      setSelectedSupportGemUid((prev) => (prev === itemUid ? null : itemUid));
      setSelectedSkillGemUid(null);
      if (mobileMode) setMobileGemStep('sockets');
      return;
    }

    if (itemDef?.type === 'skill_gem') {
      setSelectedSkillGemUid((prev) => (prev === itemUid ? null : itemUid));
      setSelectedSupportGemUid(null);
      if (mobileMode) setMobileGemStep('sockets');
      return;
    }

    setSelectedSupportGemUid(null);
    setSelectedSkillGemUid(null);
    onItemClick(itemUid);
  };

  // Shorthand for tiles
  const eq = equipment ?? {};
  const T  = (key) => (
    <EquipSlotTile
      slotKey={key}
      entry={eq[key]}
      cursorItem={cursorItem}
      onSlotClick={handleSlotActivation}
      mobileMode={mobileMode}
      tileSize={tileSize}
    />
  );

  const renderInventoryGrid = (showHint = true) => (
    <div className={`inv-grid-wrap${showBagPanel ? '' : ' inv-mobile-hidden'}`}>
      <div
        className="inv-grid"
        style={{
          width:               cols * cellSize,
          height:              rows * cellSize,
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gridTemplateRows:    `repeat(${rows}, ${cellSize}px)`,
        }}
      >
        {Array.from({ length: rows * cols }, (_, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          return (
            <div
              key={`c${i}`}
              className="inv-cell"
              onClick={() => {
                if (suppressGhostClick()) return;
                onCellClick(col, row);
              }}
              onTouchEnd={(e) => {
                if (!mobileMode) return;
                e.preventDefault();
                e.stopPropagation();
                suppressClickUntilRef.current = Date.now() + 300;
                pulse(6);
                onCellClick(col, row);
              }}
              onTouchCancel={cancelTouchPress}
            />
          );
        })}

        {items.map((item) => (
          <div
            key={item.uid}
            className={`inv-item inv-item--${item.rarity}`}
            draggable={!mobileMode && tab === 'gems' && isGemItem(item)}
            style={{
              position:    'absolute',
              left:        item.gridX * cellSize,
              top:         item.gridY * cellSize,
              width:       item.gridW * cellSize,
              height:      item.gridH * cellSize,
              borderColor: RARITY_COLORS[item.rarity] ?? RARITY_COLORS.normal,
            }}
            data-gem-selected={tab === 'gems' && (selectedSupportGemUid === item.uid || selectedSkillGemUid === item.uid) ? 'true' : undefined}
            data-mobile-selected={mobileMode && selectedMobileItemUid === item.uid ? 'true' : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (suppressGhostClick()) return;
              handleInventoryItemActivation(item.uid, item);
            }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onItemRightClick(item.uid); }}
            onTouchStart={startLongPress(() => onItemRightClick(item.uid))}
            onTouchEnd={finishTouchTap(() => handleInventoryItemActivation(item.uid, item))}
            onTouchCancel={cancelTouchPress}
            onMouseEnter={() => setHoveredItem(item)}
            onMouseLeave={() => setHoveredItem(null)}
            onDragStart={(e) => {
              if (mobileMode || tab !== 'gems' || !isGemItem(item)) return;
              e.dataTransfer.effectAllowed = 'move';
              if (item.type === 'skill_gem') {
                e.dataTransfer.setData('application/x-sre-skill-gem', item.uid);
                e.dataTransfer.setData('text/plain', `skill_gem:${item.uid}`);
                setSelectedSkillGemUid(item.uid);
                setSelectedSupportGemUid(null);
                return;
              }

              e.dataTransfer.setData('application/x-sre-support-gem', item.uid);
              e.dataTransfer.setData('text/plain', `support_gem:${item.uid}`);
              setSelectedSupportGemUid(item.uid);
              setSelectedSkillGemUid(null);
            }}
          >
            <span className="inv-item-icon-glyph">{getItemIcon(item)}</span>
            <span
              className="inv-item-name"
              style={{ color: RARITY_COLORS[item.rarity] ?? RARITY_COLORS.normal }}
            >
              {item.name}
            </span>
          </div>
        ))}
      </div>

      {showHint && (
        <p className="inv-hint inv-hint--help">
          {mobileMode
            ? 'Tap: open actions or place · Hold: quick-equip'
            : 'Left-click: pick up · Right-click: equip'}
        </p>
      )}
    </div>
  );

  const handleSelectedItemAction = (action) => {
    if (!selectedMobileItem) return;

    if (action === 'move') {
      onItemClick(selectedMobileItem.uid);
      setSelectedMobileItemUid(null);
      return;
    }

    if (action === 'quick') {
      if (selectedMobileItem.type === 'skill_gem') {
        onTabChange?.('gems');
        setSelectedSkillGemUid(selectedMobileItem.uid);
        setSelectedSupportGemUid(null);
        setMobileGemStep('sockets');
        setSelectedMobileItemUid(null);
        return;
      }
      onItemRightClick(selectedMobileItem.uid);
      setSelectedMobileItemUid(null);
      return;
    }

    if (action === 'gems') {
      onTabChange?.('gems');
      if (selectedMobileItem.type === 'support_gem') {
        setSelectedSupportGemUid(selectedMobileItem.uid);
        setSelectedSkillGemUid(null);
      }
      if (selectedMobileItem.type === 'skill_gem') {
        setSelectedSkillGemUid(selectedMobileItem.uid);
        setSelectedSupportGemUid(null);
      }
      setMobileGemStep('sockets');
      setSelectedMobileItemUid(null);
      return;
    }

    if (action === 'drop') {
      onDropItem?.(selectedMobileItem.uid);
      setSelectedSupportGemUid((prev) => (prev === selectedMobileItem.uid ? null : prev));
      setSelectedSkillGemUid((prev) => (prev === selectedMobileItem.uid ? null : prev));
      setSelectedMobileItemUid(null);
    }
  };

  const renderGemSelectionList = () => (
    <div className="inv-gem-picker">
      <div className="inv-gem-picker-section">
        <div className="inv-gem-picker-title">Support Gems</div>
        {supportGemItems.length === 0 ? (
          <p className="inv-gem-picker-empty">No support gems in inventory yet. They will appear here once found or purchased.</p>
        ) : (
          supportGemItems.map((item) => {
            const selected = selectedSupportGemUid === item.uid;
            return (
              <button
                key={item.uid}
                type="button"
                className={`inv-gem-pick${selected ? ' inv-gem-pick--selected' : ''}`}
                onClick={() => handleInventoryItemActivation(item.uid, item)}
                onContextMenu={(e) => { e.preventDefault(); onItemRightClick(item.uid); }}
                onTouchStart={startLongPress(() => onItemRightClick(item.uid))}
                onTouchEnd={finishTouchTap(() => handleInventoryItemActivation(item.uid, item), 6)}
                onTouchCancel={cancelTouchPress}
              >
                <span className="inv-gem-pick-icon">{getItemIcon(item)}</span>
                <span className="inv-gem-pick-meta">
                  <span className="inv-gem-pick-name" style={{ color: RARITY_COLORS[item.rarity] ?? RARITY_COLORS.normal }}>
                    {item.name}
                  </span>
                  <span className="inv-gem-pick-hint">{selected ? 'Ready to link — open Link Skills.' : 'Tap to prepare for socketing.'}</span>
                </span>
              </button>
            );
          })
        )}
      </div>

      {skillGemItems.length > 0 && (
        <div className="inv-gem-picker-section">
          <div className="inv-gem-picker-title">Skill Gems</div>
          {skillGemItems.map((item) => (
            <button
              key={item.uid}
              type="button"
              className={`inv-gem-pick inv-gem-pick--skill${selectedSkillGemUid === item.uid ? ' inv-gem-pick--selected' : ''}`}
              onClick={() => handleInventoryItemActivation(item.uid, item)}
              onContextMenu={(e) => { e.preventDefault(); onItemRightClick(item.uid); }}
              onTouchStart={startLongPress(() => onItemRightClick(item.uid))}
              onTouchEnd={finishTouchTap(() => handleInventoryItemActivation(item.uid, item), 6)}
              onTouchCancel={cancelTouchPress}
            >
              <span className="inv-gem-pick-icon">{getItemIcon(item)}</span>
              <span className="inv-gem-pick-meta">
                <span className="inv-gem-pick-name" style={{ color: RARITY_COLORS[item.rarity] ?? RARITY_COLORS.normal }}>
                  {item.name}
                </span>
                <span className="inv-gem-pick-hint">
                  {selectedSkillGemUid === item.uid ? 'Ready to equip — open Link Skills.' : 'Tap to prepare for equipping into Primary/Q/E/R.'}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const gap = mobileMode ? 6 : 4; // px gap between doll slots

  return (
    <div className="inventory-overlay" onContextMenu={(e) => e.preventDefault()}>
      <div className={`inventory-panel inv-panel-wide phone-shell-panel${tab === 'gems' ? ' inv-panel-gems' : ''}`}>
        {/* ── Header ──────────────────────────────────────── */}
        <div className="inv-header phone-shell-header">
          <span className="inv-title">INVENTORY</span>

          {/* Tab switcher */}
          <div className="inv-tabs">
            <button
              className={`inv-tab${tab === 'equipment' ? ' inv-tab--active' : ''}`}
              onClick={() => onTabChange?.('equipment')}
            >
              ⚔ Equipment
            </button>
            <button
              className={`inv-tab${tab === 'gems' ? ' inv-tab--active' : ''}`}
              onClick={() => onTabChange?.('gems')}
            >
              ◆ Gems
            </button>
          </div>

          <div className="inv-header-hint inv-header-hint--help">
            {mobileMode ? (
              <>{mobileSection === 'bag'
                ? 'Tap to move · hold an item to quick-equip or use it · tap a destination to place'
                : 'Your worn gear is grouped here so it is easier to manage on smaller screens.'}</>
            ) : (
              <><kbd>V</kbd> equip &nbsp;·&nbsp; <kbd>G</kbd> gems &nbsp;·&nbsp; <kbd>Esc</kbd> close</>
            )}
          </div>
          <div className="inv-header-hint inv-header-hint--gold">Gold: {gold ?? 0}</div>
          {feedback && <div className="inv-header-hint inv-header-hint--feedback">{feedback}</div>}
          <button className="btn inv-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className={`inv-content phone-shell-scroll${mobileMode ? ' inv-content--mobile' : ''}`}>

        {mobileMode && tab === 'equipment' && (
          <>
            <div className="inv-mobile-view-tabs">
              <button
                type="button"
                className={`inv-mobile-view-tab${mobileSection === 'bag' ? ' inv-mobile-view-tab--active' : ''}`}
                onClick={() => setMobileSection('bag')}
              >
                🎒 Bag
              </button>
              <button
                type="button"
                className={`inv-mobile-view-tab${mobileSection === 'gear' ? ' inv-mobile-view-tab--active' : ''}`}
                onClick={() => setMobileSection('gear')}
              >
                🛡 Gear
              </button>
            </div>

            <div className="inv-section-card">
              <div>
                <div className="inv-section-step">{mobileSection === 'bag' ? 'Bag view' : 'Gear view'}</div>
                <div className="inv-section-copy">
                  {mobileSection === 'bag'
                    ? 'Browse loot here. Tap an item to open actions, use Pick Up to move it, or hold to quick-equip or use it.'
                    : 'Manage what you are wearing here. Tap an equipment slot to place or swap the held item.'}
                </div>
              </div>
            </div>
          </>
        )}

        {mobileMode && tab === 'gems' && (
          <>
            <div className="inv-mobile-view-tabs inv-mobile-view-tabs--gems">
              <button
                type="button"
                className={`inv-mobile-view-tab${mobileGemStep === 'supports' ? ' inv-mobile-view-tab--active' : ''}`}
                onClick={() => setMobileGemStep('supports')}
              >
                ① Support Gems
              </button>
              <button
                type="button"
                className={`inv-mobile-view-tab${mobileGemStep === 'sockets' ? ' inv-mobile-view-tab--active' : ''}`}
                onClick={() => setMobileGemStep('sockets')}
              >
                ② Link Skills
              </button>
            </div>

            <div className="inv-section-card inv-section-card--gems">
              <div>
                <div className="inv-section-step">{selectedSupportGem ? 'Step 2 · Link the selected support' : 'Step 1 · Choose a support gem'}</div>
                <div className="inv-section-copy">
                  {selectedSupportGem
                    ? <>Selected: <strong>{selectedSupportGem.name}</strong>. Open <strong>Link Skills</strong> and tap a highlighted compatible socket.</>
                    : selectedSkillGem
                      ? <>Selected: <strong>{selectedSkillGem.name}</strong>. Open <strong>Link Skills</strong> and tap a slot action to equip it.</>
                      : 'Start by picking a support gem or skill gem from your inventory, then move to Link Skills.'}
                </div>
              </div>
              {(selectedSupportGem || selectedSkillGem) && (
                <div className="inv-section-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setMobileGemStep('supports')}>Change</button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectedSupportGemUid(null);
                      setSelectedSkillGemUid(null);
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Tab Content ─────────────────────────────────── */}
        {tab === 'equipment' && (
        <div className={`inv-body${mobileMode ? ' inv-body--mobile' : ''}`}>
          {/* ── ARPG Paper Doll ─────────────────────────── */}
          <div className={`equip-doll-arpg${showGearPanel ? '' : ' inv-mobile-hidden'}`} style={{ gap }}>

            {/* Row 1 — Helmet centred */}
            <div className="doll-row" style={{ gap, justifyContent: 'center' }}>
              {T('helmet')}
            </div>

            {/* Row 2 — MainHand | Amulet | OffHand */}
            <div className="doll-row" style={{ gap }}>
              {T('mainhand')}
              <div className="doll-col-mid" style={{ gap }}>
                {T('amulet')}
                {/* spacer to align ring slots */}
                <div style={{ flex: 1 }} />
              </div>
              {T('offhand')}
            </div>

            {/* Row 3 — Ring1 | Body | Ring2 */}
            <div className="doll-row" style={{ gap }}>
              {T('ring1')}
              {T('bodyarmor')}
              {T('ring2')}
            </div>

            {/* Row 4 — Gloves | Belt | Boots */}
            <div className="doll-row" style={{ gap }}>
              {T('gloves')}
              {T('belt')}
              {T('boots')}
            </div>
          </div>

          {/* ── Divider ─────────────────────────────────── */}
          {!mobileMode && <div className="inv-divider" />}

          {/* ── Inventory Grid (12×6) ───────────────────── */}
          {renderInventoryGrid(true)}
        </div>
        )}

        {/* ── Gems Tab ────────────────────────────────────── */}
        {tab === 'gems' && (
          <div className={`inv-body inv-body--gems${mobileMode ? ' inv-body--mobile inv-body--gems-mobile' : ''}`}>
            {mobileMode ? (
              mobileGemStep === 'supports' ? (
                renderGemSelectionList()
              ) : (
                <GemPanel
                  primarySkill={primarySkill ?? null}
                  activeSkills={activeSkills ?? []}
                  cursorItem={cursorItem}
                  selectedSupportGem={selectedSupportGem}
                  selectedSkillGem={selectedSkillGem}
                  onClearSelectedGem={() => setSelectedSupportGemUid(null)}
                  onClearSelectedSkillGem={() => setSelectedSkillGemUid(null)}
                  onSocketGem={onSocketGem}
                  onUnsocketGem={onUnsocketGem}
                  onEquipSkillGem={onEquipSkillGem}
                  onUnequipSkillGem={onUnequipSkillGem}
                  mobileMode={mobileMode}
                  onHoverTooltip={handleGemTooltipHover}
                  onClearTooltip={clearGemTooltipHover}
                />
              )
            ) : (
              <>
                <GemPanel
                  primarySkill={primarySkill ?? null}
                  activeSkills={activeSkills ?? []}
                  cursorItem={cursorItem}
                  selectedSupportGem={selectedSupportGem}
                  selectedSkillGem={selectedSkillGem}
                  onClearSelectedGem={() => setSelectedSupportGemUid(null)}
                  onClearSelectedSkillGem={() => setSelectedSkillGemUid(null)}
                  onSocketGem={onSocketGem}
                  onUnsocketGem={onUnsocketGem}
                  onEquipSkillGem={onEquipSkillGem}
                  onUnequipSkillGem={onUnequipSkillGem}
                  onHoverTooltip={handleGemTooltipHover}
                  onClearTooltip={clearGemTooltipHover}
                />
                <div className="inv-divider" />
                {renderInventoryGrid(false)}
              </>
            )}
          </div>
        )}
        </div>
      </div>

      {mobileMode && (
        <button className="btn inv-close-fab" onClick={onClose} aria-label="Close inventory">✕</button>
      )}

      {mobileMode && selectedMobileItem && !cursorItem && tab === 'equipment' && (
        <div className="inv-item-sheet" role="dialog" aria-label="Selected inventory item actions">
          <div className="inv-item-sheet__header">
            <div>
              <div className="inv-item-sheet__eyebrow">Selected item</div>
              <div className="inv-item-sheet__title" style={{ color: RARITY_COLORS[selectedMobileItem.rarity] ?? RARITY_COLORS.normal }}>
                {selectedMobileItem.name}
              </div>
              <div className="inv-item-sheet__meta">
                {(selectedMobileItem.slot ?? selectedMobileItem.type ?? 'item').toString().replaceAll('_', ' ')} · {selectedMobileItem.gridW ?? 1}×{selectedMobileItem.gridH ?? 1}
              </div>
            </div>
            <button type="button" className="inv-item-sheet__close" onClick={() => setSelectedMobileItemUid(null)} aria-label="Close item actions">✕</button>
          </div>

          {selectedMobileItem.description && (
            <p className="inv-item-sheet__desc">{selectedMobileItem.description}</p>
          )}

          <div className="inv-item-sheet__actions">
            <button type="button" className="btn btn-primary" onClick={() => handleSelectedItemAction('move')}>
              Pick Up / Move
            </button>
            {canQuickAction && (
              <button type="button" className="btn btn-secondary" onClick={() => handleSelectedItemAction('quick')}>
                {quickActionLabel}
              </button>
            )}
            {canManageInGems && (
              <button type="button" className="btn btn-secondary" onClick={() => handleSelectedItemAction('gems')}>
                Open Gems
              </button>
            )}
            {onDropItem && (
              <button type="button" className="btn btn-secondary inv-item-sheet__danger" onClick={() => handleSelectedItemAction('drop')}>
                Drop
              </button>
            )}
          </div>
        </div>
      )}

      {mobileMode && cursorItem && (
        <div className="inv-mobile-held">
          <span className="inv-mobile-held-label">Held item</span>
          <div className={`inv-mobile-held-card inv-item inv-item--${cursorItem.rarity}`}>
            <span className="inv-item-icon-glyph">{getItemIcon(cursorItem)}</span>
            <span className="inv-item-name" style={{ color: RARITY_COLORS[cursorItem.rarity] ?? RARITY_COLORS.normal }}>
              {cursorItem.name}
            </span>
          </div>
          <span className="inv-mobile-held-hint">Tap any inventory cell or equipment slot to place it.</span>
        </div>
      )}

      {/* ── Cursor item floats after the mouse ──────── */}
      {!mobileMode && cursorItem && (
        <div
          className={`cursor-item inv-item inv-item--${cursorItem.rarity}`}
          style={{
            position:      'fixed',
            left:          mousePos.x,
            top:           mousePos.y,
            width:         cursorItem.gridW * cellSize,
            height:        cursorItem.gridH * cellSize,
            transform:     `translate(-${cellSize / 2}px, -${cellSize / 2}px)`,
            borderColor:   RARITY_COLORS[cursorItem.rarity] ?? RARITY_COLORS.normal,
            pointerEvents: 'none',
            zIndex:        9999,
          }}
        >
          <span className="inv-item-icon-glyph">{getItemIcon(cursorItem)}</span>
          <span className="inv-item-name" style={{ color: RARITY_COLORS[cursorItem.rarity] ?? RARITY_COLORS.normal }}>
            {cursorItem.name}
          </span>
        </div>
      )}

      {/* ── Tooltip ─────────────────────────────────── */}
      {hoveredItem && <ItemTooltip itemData={hoveredItem} mousePos={mousePos} />}
      {hoveredGemTooltip && <ItemTooltip itemData={hoveredGemTooltip.itemData} mousePos={hoveredGemTooltip.mousePos} />}
    </div>
  );
}
