import { useMemo, useState } from 'react';

const RARITY_COLORS = {
  normal: '#9e9e9e',
  magic:  '#6b9cd4',
  rare:   '#f1c40f',
  unique: '#c86400',
};

const VENDOR_TABS = [
  { id: 'skill',   label: '◇ Skills'   },
  { id: 'support', label: '◆ Supports' },
  { id: 'weapons', label: '⚔ Weapons'  },
  { id: 'armour',  label: '🛡 Armour'  },
  { id: 'jewelry', label: '💍 Jewelry'  },
  { id: 'maps',    label: '🗺 Maps'    },
];

// Tabs that consume vendor reroll (equipment/maps — not infinite gems)
const REROLL_TABS = new Set(['weapons', 'armour', 'jewelry', 'maps']);

function VendorRow({ row, canAfford, onBuy }) {
  const nameColor = row.rarity ? (RARITY_COLORS[row.rarity] ?? undefined) : undefined;
  return (
    <div className={`vendor-row vendor-row--${row.rarity ?? 'default'}`}>
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

export function VendorScreen({ stock = [], gold = 0, onBuy, onClose, feedback = '', onReroll, rerollCost = 5, mobileMode = false }) {
  const [tab, setTab] = useState('skill');

  const filtered = useMemo(
    () => stock.filter((r) => r.tab === tab),
    [stock, tab],
  );

  const canReroll       = REROLL_TABS.has(tab);
  const canAffordReroll = (gold ?? 0) >= rerollCost;

  return (
    <div className="vendor-overlay">
      <div className="vendor-panel">
        <div className="vendor-header">
          <div>
            <h2 className="vendor-title">Vendor</h2>
            <p className="vendor-subtitle">Browse gems, gear, and maps — all for Gold.</p>
          </div>
          <div className="vendor-gold">⬡ {gold}g</div>
        </div>

        <div className="vendor-tabs">
          {VENDOR_TABS.map((t) => (
            <button
              key={t.id}
              className={`vendor-tab ${tab === t.id ? 'vendor-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="vendor-list">
          {filtered.map((row) => (
            <VendorRow
              key={row.id}
              row={row}
              canAfford={(gold ?? 0) >= (row.price ?? 0)}
              onBuy={onBuy}
            />
          ))}
          {filtered.length === 0 && (
            <div className="vendor-empty">No stock in this tab.</div>
          )}
        </div>

        <div className="vendor-footer">
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
    </div>
  );
}
