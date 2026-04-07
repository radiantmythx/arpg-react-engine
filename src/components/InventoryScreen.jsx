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
import { useRef, useState } from 'react';
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
  cursorItem,
  mousePos,
  onClose,
  onItemClick,
  onItemRightClick,
  onCellClick,
  onSlotClick,
  // Gem tab props
  activeTab,
  onTabChange,
  primarySkill,
  activeSkills,
  onSocketGem,
  onUnsocketGem,
  mobileMode = false,
}) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [mobileSection, setMobileSection] = useState('bag');
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

  const gap = mobileMode ? 6 : 4; // px gap between doll slots

  return (
    <div className="inventory-overlay" onContextMenu={(e) => e.preventDefault()}>
      <div className={`inventory-panel inv-panel-wide${tab === 'gems' ? ' inv-panel-gems' : ''}`}>
        {/* ── Header ──────────────────────────────────────── */}
        <div className="inv-header">
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

          <div className="inv-header-hint">
            {mobileMode ? (
              <>{mobileSection === 'bag'
                ? 'Tap to move · hold an item to quick-equip or use it · tap a destination to place'
                : 'Your worn gear is grouped here so it is easier to manage on smaller screens.'}</>
            ) : (
              <><kbd>V</kbd> equip &nbsp;·&nbsp; <kbd>G</kbd> gems &nbsp;·&nbsp; <kbd>Esc</kbd> close</>
            )}
          </div>
          <div className="inv-header-hint">Gold: {gold ?? 0}</div>
          <button className="btn inv-close-btn" onClick={onClose}>✕</button>
        </div>

        {mobileMode && tab === 'equipment' && (
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
              {/* Background cells */}
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

              {/* Items — absolutely positioned */}
              {items.map((item) => (
                <div
                  key={item.uid}
                  className={`inv-item inv-item--${item.rarity}`}
                  style={{
                    position:    'absolute',
                    left:        item.gridX * cellSize,
                    top:         item.gridY * cellSize,
                    width:       item.gridW * cellSize,
                    height:      item.gridH * cellSize,
                    borderColor: RARITY_COLORS[item.rarity] ?? RARITY_COLORS.normal,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (suppressGhostClick()) return;
                    onItemClick(item.uid);
                  }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onItemRightClick(item.uid); }}
                  onTouchStart={startLongPress(() => onItemRightClick(item.uid))}
                  onTouchEnd={finishTouchTap(() => onItemClick(item.uid))}
                  onTouchCancel={cancelTouchPress}
                  onMouseEnter={() => setHoveredItem(item)}
                  onMouseLeave={() => setHoveredItem(null)}
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

            <p className="inv-hint">
              {mobileMode
                ? 'Tap: pick up or place · Hold: quick-equip / consume'
                : 'Left-click: pick up · Right-click: equip'}
            </p>
          </div>
        </div>
        )}

        {/* ── Gems Tab ────────────────────────────────────── */}
        {tab === 'gems' && (
          <GemPanel
            primarySkill={primarySkill ?? null}
            activeSkills={activeSkills ?? []}
            inventory={inventory}
            onSocketGem={onSocketGem}
            onUnsocketGem={onUnsocketGem}
            mobileMode={mobileMode}
          />
        )}
      </div>

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
    </div>
  );
}
