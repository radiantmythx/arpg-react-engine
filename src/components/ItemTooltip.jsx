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

import { highlightElementalText } from './ElementalText.jsx';
import { getWeaponTypeLabel } from '../game/data/weaponTypes.js';

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
  skill_gem: 'Skill Gem',
  support_gem: 'Support Gem',
  gem: 'Gem',
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
      return `${sign(p)}% damage`;
    }
    case 'cooldownMult': {
      const p = Math.round((1 - val) * 100);
      return p >= 0 ? `\u2212${p}% cooldown length` : `+${Math.abs(p)}% cooldown length`;
    }
    case 'maxHealthFlat':    return `${sign(val)} maximum life`;
    case 'maxManaFlat':      return `${sign(val)} maximum mana`;
    case 'healthRegenPerS':  return `${sign(val)} life regenerated per second`;
    case 'manaRegenPerS':    return `${sign(val)} mana regenerated per second`;
    case 'speedFlat':        return `${sign(val)} movement speed`;
    case 'pickupRadiusFlat': return `${sign(val)} pickup radius`;
    case 'meleeStrikeRange': return `${sign(Math.round(val * 100))}% melee strike range`;
    case 'xpMultiplier': {
      const p = Math.round((val - 1) * 100);
      return `${sign(p)}% experience gain`;
    }
    case 'armorFlat':        return `${val} armour`;
    case 'evasionFlat':      return `${val} evasion`;
    case 'energyShieldFlat': return `${val} energy shield`;
    case 'manaCostMult': {
      const p = Math.round((1 - val) * 100);
      return p >= 0 ? `\u2212${p}% mana costs` : `+${Math.abs(p)}% mana costs`;
    }
    case 'reservationMult': {
      const p = Math.round((val - 1) * 100);
      return p >= 0 ? `+${p}% reservation` : `\u2212${Math.abs(p)}% reservation`;
    }
    case 'manaCost':
      return `Mana cost: ${Math.round(val)}`;
    case 'mapItemLevel':     return `Item level ${val}`;
    case 'mapType':          return `Map type: ${val}`;
    case 'mapTheme':         return `Theme: ${val}`;
    case 'layoutFamily':     return `Layout family: ${val}`;
    case 'pathStyle':        return `Path style: ${val}`;
    case 'terrainProfile':   return `Terrain profile: ${val}`;
    case 'modCount':         return `${val} map modifier${val === 1 ? '' : 's'}`;
    default:                 return `${key}: ${val}`;
  }
}

function formatAffixLabel(affix, fallbackKind = null) {
  if (!affix) return '';
  const parts = [];
  const affixKind = affix.kind ?? fallbackKind;
  const affixType = affix.type ? `${affix.type[0].toUpperCase()}${affix.type.slice(1)}` : null;

  if (affixKind === 'implicit') {
    parts.push('Implicit');
  } else if (affixType) {
    parts.push(affixType);
  }

  if (affix.tier != null) {
    parts.push(`T${affix.tier}`);
  }

  return parts.length > 0 ? `${affix.label} (${parts.join(' · ')})` : affix.label;
}

export function ItemTooltip({ itemData, mousePos, hint }) {
  if (!itemData || !mousePos) return null;

  const rarity      = itemData.rarity ?? 'normal';
  const rarityColor = RARITY_COLORS[rarity] ?? '#9e9e9e';
  const rarityLabel = RARITY_LABELS[rarity] ?? rarity;
  const explicitAffixes = Array.isArray(itemData.explicitAffixes)
    ? itemData.explicitAffixes
    : (itemData.affixes ?? []).filter((a) => (a?.kind ?? 'explicit') !== 'implicit');
  const implicitAffixes = Array.isArray(itemData.implicitAffixes)
    ? itemData.implicitAffixes
    : (itemData.affixes ?? []).filter((a) => (a?.kind ?? 'explicit') === 'implicit');
  const baseStats   = itemData.baseStats ?? {};
  const statLines   = Object.entries(baseStats).map(([k, v]) => fmtStat(k, v));
  const description = itemData.description ?? null;
  const flavorText  = itemData.flavorText ?? null;
  const defType     = itemData.defenseType ?? null;
  const weaponTypeLabel = itemData.weaponType ? getWeaponTypeLabel(itemData.weaponType) : null;
  const handednessLabel = itemData.handedness === 'two_hand' ? 'Two-Handed' : 'One-Handed';

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
        {weaponTypeLabel && (
          <span className="itt-dt" style={{ color: '#f5c16c' }}>
            {`${weaponTypeLabel} · ${handednessLabel}`}
          </span>
        )}
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
              <div key={i} className="itt-stat">{highlightElementalText(line)}</div>
            ))}
          </div>
        </>
      )}

      {/* ── Description ───────────────────────────────────────────── */}
      {description && (
        <>
          <div className="itt-divider" />
          <div className="itt-section">
            <div className="itt-description">{highlightElementalText(description)}</div>
          </div>
        </>
      )}

      {/* ── Implicit affixes ─────────────────────────────────────── */}
      {implicitAffixes.length > 0 && (
        <>
          <div className="itt-divider" />
          <div className="itt-section">
            <div className="itt-section-label">Implicit</div>
            {implicitAffixes.map((a) => (
              <div key={a.id} className="itt-stat itt-prefix">{highlightElementalText(formatAffixLabel(a, 'implicit'))}</div>
            ))}
          </div>
        </>
      )}

      {/* ── Explicit affixes (prefix/suffix) ────────────────────── */}
      {explicitAffixes.length > 0 && (
        <>
          <div className="itt-divider" />
          <div className="itt-section">
            <div className="itt-section-label">Explicit Affixes</div>
            {explicitAffixes.map((a) => (
              <div key={a.id} className={`itt-stat itt-${a.type}`}>{highlightElementalText(formatAffixLabel(a))}</div>
            ))}
          </div>
        </>
      )}

      {/* ── Flavor / lore text ───────────────────────────────────── */}
      {flavorText && (
        <>
          <div className="itt-divider" />
          <div className="itt-section">
            <div className="itt-flavor">&ldquo;{highlightElementalText(flavorText)}&rdquo;</div>
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

