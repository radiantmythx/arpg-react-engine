/**
 * ItemPopup — shown when the player steps onto a world ItemDrop.
 * Displays item rarity, base description, procedural affixes, and current slot occupant.
 * Offers "Equip" (replaces current slot) and "Leave" (skip) actions.
 */

const RARITY_COLORS = { normal: '#9e9e9e', magic: '#6b9cd4', rare: '#f1c40f' };
const RARITY_LABELS = { normal: 'Normal',  magic: 'Magic',   rare: 'Rare'    };
const SLOT_ICONS   = { weapon: '⚔', armor: '🛡', jewelry: '💎' };
const SLOT_LABELS  = { weapon: 'Weapon Slot', armor: 'Armor Slot', jewelry: 'Jewelry Slot' };

export function ItemPopup({ itemDef, currentEquipped, onEquip, onLeave }) {
  const rarity      = itemDef.rarity ?? 'normal';
  const rarityColor = RARITY_COLORS[rarity];
  const slotIcon    = SLOT_ICONS[itemDef.slot] ?? '';
  const affixes     = itemDef.affixes ?? [];

  return (
    <div className="overlay item-popup-overlay">
      <div className="menu-box item-popup-box" style={{ borderColor: rarityColor }}>

        {/* Slot identifier */}
        <div className="item-popup-slot-label">
          {slotIcon} {SLOT_LABELS[itemDef.slot]}
        </div>

        {/* Rarity badge */}
        <div className={`item-rarity-badge item-rarity-${rarity}`}>
          {RARITY_LABELS[rarity]}
        </div>

        {/* Item name colored by rarity tier */}
        <div className="item-popup-name" style={{ color: rarityColor }}>
          {itemDef.name}
        </div>

        {/* Base description */}
        <p className="item-popup-desc">{itemDef.description}</p>

        {/* Procedural affixes */}
        {affixes.length > 0 && (
          <ul className="item-affix-list">
            {affixes.map((affix) => (
              <li key={affix.id} className={`item-affix item-affix-${affix.type}`}>
                {affix.label}
              </li>
            ))}
          </ul>
        )}

        {/* Current occupant warning */}
        {currentEquipped && (
          <p className="item-popup-replace">
            Replaces:{' '}
            <span style={{ color: currentEquipped.color }}>{currentEquipped.name}</span>
          </p>
        )}

        <div className="item-popup-actions">
          <button className="btn btn-primary" onClick={onEquip}>
            Equip
          </button>
          <button className="btn" onClick={onLeave}>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

