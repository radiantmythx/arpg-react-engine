/**
 * ItemTooltip — Diablo 2–style floating item info panel.
 *
 * Shows: slot type · defense type · rarity badge · item name · base stats ·
 *        procedural affixes · flavor text · optional hint.
 *
 * Props:
 *   itemData  — serialized item ({ name, rarity, slot, baseStats, affixes, … })
 *   mousePos  — { x, y } viewport coords; tooltip anchors near mouse
 *   hint      — optional gray hint line at the bottom (e.g. "Click to pick up")
 */

const RARITY_COLORS = {
  normal: '#9e9e9e',
  magic:  '#6b9cd4',
  rare:   '#f1c40f',
  unique: '#c86400',
};
const RARITY_LABELS = {
  normal: 'Normal',
  magic:  'Magic',
  rare:   'Rare',
  unique: 'Unique',
};
const SLOT_LABELS = {
  weapon:  'Weapon',
  offhand: 'Offhand',
  armor:   'Body Armour',
  helmet:  'Helmet',
  boots:   'Boots',
  jewelry: 'Jewelry',
  map: 'Map',
};
const DEFENSE_TYPE_LABELS = {
  'armor':                       'Armour',
  'evasion':                     'Evasion',
  'energyShield':                'Energy Shield',
  'armor/evasion':               'Armour / Evasion',
  'armor/energyShield':          'Armour / Energy Shield',
  'evasion/energyShield':        'Evasion / Energy Shield',
  'armor/evasion/energyShield':  'Armour / Evasion / Energy Shield',
};
const DEFENSE_TYPE_COLORS = {
  'armor':                       '#95a5a6',
  'evasion':                     '#27ae60',
  'energyShield':                '#3498db',
  'armor/evasion':               '#1abc9c',
  'armor/energyShield':          '#9b59b6',
  'evasion/energyShield':        '#00b894',
  'armor/evasion/energyShield':  '#a29bfe',
};

/** Format a single stat key+value into a human-readable line. */
function fmtStat(key, val) {
  const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);
  switch (key) {
    case 'damageMult': {
      const p = Math.round((val - 1) * 100);
      return `${sign(p)}% weapon damage`;
    }
    case 'cooldownMult': {
      const p = Math.round((1 - val) * 100);
      return p >= 0 ? `\u2212${p}% weapon cooldown` : `+${Math.abs(p)}% weapon cooldown`;
    }
    case 'maxHealthFlat':    return `${sign(val)} maximum life`;
    case 'healthRegenPerS':  return `${sign(val)} life regenerated per second`;
    case 'speedFlat':        return `${sign(val)} movement speed`;
    case 'pickupRadiusFlat': return `${sign(val)} pickup radius`;
    case 'xpMultiplier': {
      const p = Math.round((val - 1) * 100);
      return `${sign(p)}% experience gain`;
    }
    case 'armorFlat':        return `${val} armour`;
    case 'evasionFlat':      return `${val} evasion`;
    case 'energyShieldFlat': return `${val} energy shield`;
    case 'mapTier':          return `Map tier ${val}`;
    case 'mapItemLevel':     return `Item level ${val}`;
    default:                 return `${key}: ${val}`;
  }
}

export function ItemTooltip({ itemData, mousePos, hint }) {
  if (!itemData || !mousePos) return null;

  const rarity      = itemData.rarity ?? 'normal';
  const rarityColor = RARITY_COLORS[rarity] ?? '#9e9e9e';
  const rarityLabel = RARITY_LABELS[rarity] ?? rarity;
  const affixes     = itemData.affixes ?? [];
  const baseStats   = itemData.baseStats ?? {};
  const statLines   = Object.entries(baseStats).map(([k, v]) => fmtStat(k, v));
  const flavorText  = itemData.flavorText ?? null;
  const defType     = itemData.defenseType ?? null;

  const TOOLTIP_W = 290;
  // Anchor right of cursor; flip left if near the right edge
  const left = mousePos.x + 16 + TOOLTIP_W > window.innerWidth
    ? mousePos.x - TOOLTIP_W - 8
    : mousePos.x + 16;
  const top  = Math.min(mousePos.y, window.innerHeight - 420);

  return (
    <div
      className={`item-tooltip item-tooltip--${rarity}`}
      style={{ left, top, minWidth: TOOLTIP_W, maxWidth: TOOLTIP_W + 60 }}
    >
      {/* ── Header row: slot type + defense type ────────────────── */}
      <div className="itt-header">
        <span className="itt-slot">{SLOT_LABELS[itemData.slot] ?? itemData.slot}</span>
        {defType && (
          <span className="itt-dt" style={{ color: DEFENSE_TYPE_COLORS[defType] ?? '#aaa' }}>
            {DEFENSE_TYPE_LABELS[defType] ?? defType}
          </span>
        )}
      </div>

      {/* ── Rarity + Item name ───────────────────────────────────── */}
      <div className="itt-name-block">
        <div className={`itt-rarity-badge itt-rarity-${rarity}`}>{rarityLabel}</div>
        <div className="itt-name" style={{ color: rarityColor }}>{itemData.name}</div>
      </div>

      {/* ── Base stats ───────────────────────────────────────────── */}
      {statLines.length > 0 && (
        <>
          <div className="itt-divider" />
          <div className="itt-section">
            {statLines.map((line, i) => (
              <div key={i} className="itt-stat">{line}</div>
            ))}
          </div>
        </>
      )}

      {/* ── Procedural affixes ──────────────────────────────────── */}
      {affixes.length > 0 && (
        <>
          <div className="itt-divider" />
          <div className="itt-section">
            {affixes.map((a) => (
              <div key={a.id} className={`itt-stat itt-${a.type}`}>{a.label}</div>
            ))}
          </div>
        </>
      )}

      {/* ── Flavor / lore text ───────────────────────────────────── */}
      {flavorText && (
        <>
          <div className="itt-divider" />
          <div className="itt-section">
            <div className="itt-flavor">&ldquo;{flavorText}&rdquo;</div>
          </div>
        </>
      )}

      {/* ── Pickup / action hint ────────────────────────────────── */}
      {hint && (
        <>
          <div className="itt-divider" />
          <div className="itt-hint">{hint}</div>
        </>
      )}
    </div>
  );
}

