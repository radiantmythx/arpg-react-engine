import { useMemo, useState } from 'react';
import { calcSellPrice } from '../game/ItemPricing.js';
import { ItemTooltip } from './ItemTooltip.jsx';

const RARITY_COLORS = {
  normal: '#9e9e9e',
  magic:  '#6b9cd4',
  rare:   '#f1c40f',
  unique: '#c86400',
};

const VENDOR_TABS = [
  { id: 'sell',    label: '💰 Sell' },
  { id: 'skill',   label: '◇ Skills'   },
  { id: 'support', label: '◆ Supports' },
  { id: 'weapons', label: '⚔ Weapons'  },
  { id: 'armour',  label: '🛡 Armour'  },
  { id: 'jewelry', label: '💍 Jewelry'  },
  { id: 'maps',    label: '🗺 Maps'    },
];

// Tabs that consume vendor reroll (equipment/maps — not infinite gems)
const REROLL_TABS = new Set(['weapons', 'armour', 'jewelry', 'maps']);

const SKILL_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'spell', label: 'Spell' },
  { id: 'attack', label: 'Attack' },
  { id: 'movement', label: 'Movement' },
];

function deriveSkillTags(row) {
  const text = `${row?.name ?? ''} ${row?.description ?? ''}`.toLowerCase();
  const tags = new Set();

  const isActiveSkill = row?.icon === '✦';
  if (isActiveSkill || /weapon|melee|blade|cleave|strike|spear|slam/.test(text)) {
    tags.add('attack');
  }

  if (!isActiveSkill || /spell|arcane|fire|frost|lightning|chaos|vortex|nova|gravity/.test(text)) {
    tags.add('spell');
  }

  if (/blink|warp|teleport|dash|movement|speed|travel/.test(text)) {
    tags.add('movement');
  }

  if (tags.size === 0) {
    tags.add('spell');
  }

  return tags;
}

function VendorRow({ row, canAfford, onBuy, onHoverItem, onClearHover }) {
  const nameColor = row.rarity ? (RARITY_COLORS[row.rarity] ?? undefined) : undefined;
  return (
    <div
      className={`vendor-row vendor-row--${row.rarity ?? 'default'}`}
      onMouseEnter={(e) => onHoverItem?.(row.itemDef ?? null, e)}
      onMouseMove={(e) => onHoverItem?.(row.itemDef ?? null, e)}
      onMouseLeave={() => onClearHover?.()}
    >
      <div className="vendor-item-main">
        <span className="vendor-item-icon">{row.icon}</span>
        <div className="vendor-item-meta">
          <span className="vendor-item-name" style={nameColor ? { color: nameColor } : undefined}>
            {row.name}
          </span>
          <span className="vendor-item-desc">{row.description}</span>
        </div>
      </div>
      <div className="vendor-item-buy">
        <span className={`vendor-price ${canAfford ? 'vendor-price--ok' : 'vendor-price--low'}`}>
          {row.price}g
        </span>
        <button className="btn btn-primary vendor-buy-btn" disabled={!canAfford} onClick={() => onBuy(row.id)}>
          Buy
        </button>
      </div>
    </div>
  );
}

function SellInventoryRow({ item, onSell }) {
  const sellPrice = calcSellPrice(item);
  const nameColor = item.rarity ? (RARITY_COLORS[item.rarity] ?? undefined) : undefined;
  const gridSize = `${item.gridW ?? 1}×${item.gridH ?? 1}`;

  return (
    <div className={`vendor-row vendor-row--${item.rarity ?? 'default'}`}>
      <div className="vendor-item-main">
        <span className="vendor-item-icon">📦</span>
        <div className="vendor-item-meta">
          <span className="vendor-item-name" style={nameColor ? { color: nameColor } : undefined}>
            {item.name}
          </span>
          <span className="vendor-item-desc">{item.description || `${gridSize} slot`}</span>
        </div>
      </div>
      <div className="vendor-item-buy">
        <span className="vendor-price vendor-price--ok">
          {sellPrice}g
        </span>
        <button className="btn btn-primary vendor-buy-btn" onClick={() => onSell(item.uid)}>
          Sell
        </button>
      </div>
    </div>
  );
}

export function VendorScreen({
  stock = [],
  inventory = null,
  gold = 0,
  onBuy,
  onClose,
  onSell,
  feedback = '',
  onReroll,
  rerollCost = 5,
  mobileMode = false,
}) {
  const [tab, setTab] = useState('skill');
  const [skillFilter, setSkillFilter] = useState('all');
  const [hoveredItem, setHoveredItem] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);

  const handleHoverItem = (itemDef, event) => {
    if (!itemDef || !event) {
      setHoveredItem(null);
      setHoverPos(null);
      return;
    }
    setHoveredItem(itemDef);
    setHoverPos({ x: event.clientX, y: event.clientY });
  };

  const clearHoverItem = () => {
    setHoveredItem(null);
    setHoverPos(null);
  };

  // Handle sell tab separately since it uses inventory instead of stock
  const inventoryItems = useMemo(() => {
    if (!inventory || !Array.isArray(inventory.items)) return [];
    return inventory.items;
  }, [inventory]);

  const filtered = useMemo(
    () => {
      if (tab === 'sell') {
        return inventoryItems;
      }
      const tabRows = stock.filter((r) => r.tab === tab);
      if (tab !== 'skill' || skillFilter === 'all') {
        return tabRows;
      }
      return tabRows.filter((row) => deriveSkillTags(row).has(skillFilter));
    },
    [stock, tab, inventoryItems, skillFilter],
  );

  const canReroll       = REROLL_TABS.has(tab) && tab !== 'sell';
  const canAffordReroll = (gold ?? 0) >= rerollCost;

  return (
    <div className="vendor-overlay">
      <div className="vendor-panel phone-shell-panel">
        <div className="vendor-header phone-shell-header">
          <div>
            <h2 className="vendor-title">Vendor</h2>
            <p className="vendor-subtitle">{tab === 'sell' ? 'Sell your unwanted gear for gold.' : 'Browse gems, gear, and maps — all for Gold.'}</p>
          </div>
          <div className="vendor-gold">⬡ {gold}g</div>
        </div>

        <div className="vendor-tabs">
          {VENDOR_TABS.map((t) => (
            <button
              key={t.id}
              className={`vendor-tab ${tab === t.id ? 'vendor-tab--active' : ''}`}
              onClick={() => {
                setTab(t.id);
                if (t.id !== 'skill') {
                  setSkillFilter('all');
                }
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'skill' && (
          <div className="vendor-skill-tags" aria-label="Skill tag filters">
            {SKILL_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`vendor-skill-tag${skillFilter === filter.id ? ' vendor-skill-tag--active' : ''}`}
                onClick={() => setSkillFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}

        <div className="vendor-list phone-shell-scroll">
          {tab === 'sell' ? (
            filtered.map((item) => (
              <SellInventoryRow key={item.uid} item={item} onSell={onSell} />
            ))
          ) : (
            filtered.map((row) => (
              <VendorRow
                key={row.id}
                row={row}
                canAfford={(gold ?? 0) >= (row.price ?? 0)}
                onBuy={onBuy}
                onHoverItem={handleHoverItem}
                onClearHover={clearHoverItem}
              />
            ))
          )}
          {filtered.length === 0 && (
            <div className="vendor-empty">
              {tab === 'sell' ? 'No items to sell.' : 'No stock in this tab.'}
            </div>
          )}
        </div>

        <div className="vendor-footer phone-shell-footer">
          <span className="vendor-feedback">{feedback || (mobileMode ? 'Tip: tap to move items, or hold an inventory item to quick-equip / use it.' : 'Tip: right-click a gem in inventory to equip it.')}</span>
          <div className="vendor-footer-actions">
            {canReroll && (
              <button
                className="btn btn-secondary vendor-reroll-btn"
                disabled={!canAffordReroll}
                onClick={onReroll}
                title={`Reroll gear stock for ${rerollCost}g`}
              >
                🔄 Reroll ({rerollCost}g)
              </button>
            )}
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {hoveredItem && hoverPos && <ItemTooltip itemData={hoveredItem} mousePos={hoverPos} />}
    </div>
  );
}
