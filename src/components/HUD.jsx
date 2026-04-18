import { useState } from 'react';
import { highlightElementalText } from './ElementalText.jsx';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Mini paperdoll config (10 slots) ────────────────────────────────────────
const DOLL_SLOTS = {
  helmet:    { icon: '⛑', label: 'Helmet'    },
  mainhand:  { icon: '⚔', label: 'Main Hand' },
  offhand:   { icon: '🗡', label: 'Off Hand'  },
  bodyarmor: { icon: '🛡', label: 'Body'      },
  amulet:    { icon: '📿', label: 'Amulet'    },
  ring1:     { icon: '💍', label: 'Ring L'    },
  ring2:     { icon: '💍', label: 'Ring R'    },
  gloves:    { icon: '🧤', label: 'Gloves'    },
  belt:      { icon: '🎗', label: 'Belt'      },
  boots:     { icon: '👢', label: 'Boots'     },
};

const RARITY_CLRS = {
  normal: '#9e9e9e',
  magic:  '#6b9cd4',
  rare:   '#f1c40f',
  unique: '#c86400',
};

function fmtStat(key, value) {
  const map = {
    damageMult:       (v) => `+${Math.round((v - 1) * 100)}% weapon damage`,
    cooldownMult:     (v) => `${Math.round((v - 1) * 100)}% weapon cooldown`,
    maxHealthFlat:    (v) => `+${v} max life`,
    healthRegenPerS:  (v) => `+${v} life regen/s`,
    xpMultiplier:     (v) => `+${Math.round((v - 1) * 100)}% XP gain`,
    maxManaFlat:      (v) => `+${v} max mana`,
    manaRegenPerS:    (v) => `+${v} mana regen/s`,
    manaCostMult:     (v) => `${Math.round((v - 1) * 100)}% mana costs`,
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

function DollTooltip({ slotKey, entry }) {
  const cfg   = DOLL_SLOTS[slotKey] ?? { label: slotKey };
  const color = RARITY_CLRS[entry.rarity] ?? RARITY_CLRS.normal;
  const stats  = Object.entries(entry.baseStats ?? {}).filter(([k]) => k !== 'mapItemLevel');
  const affixes = entry.affixes ?? [];
  return (
    <div className="doll-mini-tooltip">
      <div className="doll-tip-name" style={{ color }}>{entry.name}</div>
      <div className="doll-tip-slot">{cfg.label} · {entry.rarity ?? 'normal'}</div>
      {entry.description && <div className="doll-tip-desc">{highlightElementalText(entry.description)}</div>}
      {stats.length > 0 && (
        <div className="doll-tip-stats">
          {stats.map(([k, v]) => <div key={k} className="doll-tip-stat">{highlightElementalText(fmtStat(k, v))}</div>)}
        </div>
      )}
      {affixes.length > 0 && (
        <div className="doll-tip-affixes">
          {affixes.map((a, i) => (
            <div key={i} className="doll-tip-affix">{highlightElementalText(a.label ?? a.id)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtBreakdownLabel(key) {
  const labels = {
    Physical: 'Physical',
    Blaze: 'Blaze',
    Thunder: 'Thunder',
    Frost: 'Frost',
    Holy: 'Holy',
    Unholy: 'Unholy',
  };
  return labels[key] ?? key;
}

function fmtDamageEntry(entry) {
  if (entry == null) return null;
  if (typeof entry === 'object') {
    const min = Number(entry.min);
    const max = Number(entry.max);
    if (Number.isFinite(min) && Number.isFinite(max)) return `${Math.round(min)}-${Math.round(max)}`;
  }
  return `${Math.round(Number(entry) || 0)}`;
}

function SkillTooltip({ skill, pos }) {
  if (!skill || !pos) return null;
  const breakdown = skill.damageBreakdown ?? null;
  const breakdownEntries = breakdown ? Object.entries(breakdown) : [];
  const hasDamage = Number.isFinite(skill.computedDamage);
  const hasRange = skill.damageRange && Number.isFinite(skill.damageRange.min) && Number.isFinite(skill.damageRange.max);
  return (
    <div className="hud-skill-tooltip" style={{ left: pos.x, top: pos.y }}>
      <div className="hud-skill-tooltip__name">{skill.name}</div>
      {skill.description && <div className="hud-skill-tooltip__desc">{highlightElementalText(skill.description)}</div>}
      {hasDamage && (
        <div className="hud-skill-tooltip__line">
          Damage: <strong>{hasRange ? `${Math.round(skill.damageRange.min)}-${Math.round(skill.damageRange.max)}` : Math.round(skill.computedDamage)}</strong>
        </div>
      )}
      {breakdownEntries.length > 0 && (
        <div className="hud-skill-tooltip__breakdown">
          {breakdownEntries.map(([k, v]) => (
            <div key={k} className="hud-skill-tooltip__line">
              <span className={`elem-word elem-word--${String(k).toLowerCase()}`}>{fmtBreakdownLabel(k)}</span>: {fmtDamageEntry(v)}
            </div>
          ))}
        </div>
      )}
      {skill.castTime > 0 && (
        <div className="hud-skill-tooltip__line">Cast: {skill.castTime.toFixed(2)}s</div>
      )}
      {skill.manaCost > 0 && (
        <div className="hud-skill-tooltip__line">Mana: {Math.round(skill.manaCost)}</div>
      )}
      {skill.blockedReason && (
        <div className="hud-skill-tooltip__line hud-skill-tooltip__line--blocked">
          {skill.blockedReason}
        </div>
      )}
      {skill.requirementHint && (
        <div className="hud-skill-tooltip__line hud-skill-tooltip__line--hint">
          {skill.requirementHint}
        </div>
      )}
      {skill.tags?.length > 0 && (
        <div className="hud-skill-tooltip__tags">
          {skill.tags.map((t) => (
            <span key={t} className={`hud-skill-tag elem-word elem-word--${String(t).toLowerCase()}`}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniSlot({ slotKey, entry, onHover }) {
  const cfg   = DOLL_SLOTS[slotKey];
  const color = entry ? (RARITY_CLRS[entry.rarity] ?? RARITY_CLRS.normal) : undefined;
  return (
    <div
      className={`doll-mini-slot${entry ? ' doll-mini-slot--filled' : ''}`}
      style={color ? { borderColor: color } : undefined}
      title={entry ? `${entry.name}` : cfg.label}
      onMouseEnter={() => entry && onHover({ slotKey, entry })}
      onMouseLeave={() => onHover(null)}
    >
      <span className="doll-mini-icon" style={color ? { color } : undefined}>
        {cfg.icon}
      </span>
    </div>
  );
}

export function HUD({
  hud,
  hideTimer = false,
  hideCoreOverlays = false,
  mobileMode = false,
  compactMode = false,
  screenContext = 'RUNNING',
  onDevAddGold = null,
  onDevLevelUp = null,
  onDevUnlockAllActs = null,
}) {
  const [hoveredEquip, setHoveredEquip] = useState(null);
  const [hoveredSkill, setHoveredSkill] = useState(null);
  const [hoveredPotion, setHoveredPotion] = useState(null);

  const { health, maxHealth, xp, xpToNext, level, elapsed, kills, equipment, skillPoints, shardsThisRun,
      mana = 0, maxMana = 0, energyShield, maxEnergyShield, primarySkill, activeSkills, portalsRemaining = 0,
          mapEnemiesKilled = 0, mapEnemiesTotal = 0, mapContext = false, mapMods = [], mapName = '', mapAreaLevel = 0,
      lockedTarget = null, training = null, debugMode = false, minimapMode = 0, potions = [] } = hud;
  const hpPct = Math.max(0, (health / maxHealth) * 100);
    const manaPct = maxMana > 0 ? Math.max(0, (mana / maxMana) * 100) : 0;
  const xpPct = Math.max(0, (xp / xpToNext) * 100);
  const esPct = maxEnergyShield > 0 ? Math.max(0, (energyShield / maxEnergyShield) * 100) : 0;
  const hpColor = hpPct > 50 ? '#4ecdc4' : hpPct > 25 ? '#ffe66d' : '#ff6b6b';
  const compactHud = mobileMode && compactMode;
  const hidePaperdoll = mobileMode && (compactMode || screenContext === 'HUB');
  const showSkillHotbar = !mobileMode && (primarySkill || activeSkills) && (screenContext === 'RUNNING' || screenContext === 'HUB');

  return (
    <div className={`hud${mobileMode ? ' hud--mobile' : ''}${compactHud ? ' hud--compact' : ''}`}>
      {/* Timer / map entry banner — top center */}
      {!hideCoreOverlays && (
        <div className="hud-center">
          {!mapContext && !hideTimer && <div className="timer">{formatTime(elapsed)}</div>}
          {mapContext && mapName && elapsed < 3 && (
            <div className="map-entry-banner" style={{ opacity: Math.max(0, 1 - elapsed / 3) }}>
              <span className="map-entry-name">{mapName}</span>
              <span className="map-entry-tier">Area Lv. {mapAreaLevel || 1}</span>
            </div>
          )}
        </div>
      )}

      {!hideCoreOverlays && (
        <div className="hud-bottom">
          <div className="bar-row">
            <span className="bar-label">{compactHud ? '❤️' : 'HP'}</span>
            <div className="bar-bg">
              <div className="bar-fill" style={{ width: `${hpPct}%`, background: hpColor }} />
            </div>
            {!compactHud && (
              <span className="bar-value">
                {Math.ceil(health)}/{maxHealth}
              </span>
            )}
          </div>
          <div className="bar-row">
            <span className="bar-label">{compactHud ? '✨' : 'XP'}</span>
            <div className="bar-bg">
              <div className="bar-fill xp-fill" style={{ width: `${xpPct}%` }} />
            </div>
            {!compactHud && (
              <span className="bar-value">
                {xp}/{xpToNext}
              </span>
            )}
          </div>

          {maxMana > 0 && (
            <div className="bar-row">
              <span className="bar-label mana-label">{compactHud ? '💧' : 'MP'}</span>
              <div className="bar-bg">
                <div className="bar-fill mana-fill" style={{ width: `${manaPct}%` }} />
              </div>
              {!compactHud && (
                <span className="bar-value">
                  {Math.ceil(mana)}/{Math.round(maxMana)}
                </span>
              )}
            </div>
          )}

          {maxEnergyShield > 0 && (
            <div className="bar-row">
              <span className="bar-label es-label">{compactHud ? '🛡️' : 'ES'}</span>
              <div className="bar-bg">
                <div className="bar-fill es-fill" style={{ width: `${esPct}%` }} />
              </div>
              {!compactHud && (
                <span className="bar-value">
                  {Math.ceil(energyShield)}/{Math.round(maxEnergyShield)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Skill point ready badge */}
      {skillPoints > 0 && (
        <div className="skill-point-badge">
          {mobileMode ? `⛆ ${skillPoints}` : `⛆ ${skillPoints} Skill Point${skillPoints > 1 ? 's' : ''} - press [T]`}
        </div>
      )}

      {/* Chaos Shard counter */}
      {shardsThisRun > 0 && (
        <div className="shard-badge">
          ◆ {shardsThisRun}
        </div>
      )}

      {!hideCoreOverlays && mapContext && portalsRemaining >= 0 && (
        <div className="portal-hud-badge">
          <span className="portal-hud-label">Portals</span>
          <div className="portal-hud-pips">
            {Array.from({ length: 3 }, (_, i) => (
              <span
                key={i}
                className={`portal-hud-pip ${i < portalsRemaining ? 'portal-hud-pip--active' : 'portal-hud-pip--used'}`}
              />
            ))}
          </div>
          {mapEnemiesTotal > 0 && (
            <span className="portal-hud-clear">Cleared {mapEnemiesKilled}/{mapEnemiesTotal}</span>
          )}
        </div>
      )}

      {mapContext && mapMods.length > 0 && (
        <div className="map-mod-hud" aria-label="Active map modifiers">
          {mapMods.map((mod) => (
            <span
              key={mod.id}
              className={`map-mod-chip map-mod-chip--${mod.type ?? 'special'}`}
              title={mod.label ?? mod.id}
            >
              {(mod.id ?? 'mod').split('_').map((p) => p[0]).join('').toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {!mobileMode && lockedTarget && (
        <div className={`target-lock-hud${lockedTarget.isBoss ? ' target-lock-hud--boss' : ''}`}>
          <span className="target-lock-label">LOCK</span>
          <span className="target-lock-name">{lockedTarget.name}</span>
          <span className="target-lock-bar"><span style={{ width: `${Math.round((lockedTarget.healthPct ?? 0) * 100)}%` }} /></span>
        </div>
      )}

      {!mobileMode && screenContext === 'HUB' && training?.enabled && (
        <div className="training-hud-card" aria-label="Training metrics">
          <div className="training-hud-title">Training Dummy</div>
          <div className="training-hud-line">DPS ({training.windowSeconds}s): <strong>{Math.round(training.dps ?? 0)}</strong></div>
          <div className="training-hud-line">Mana Spend/s: <strong>{(training.manaSpendPerS ?? 0).toFixed(1)}</strong></div>
          <div className="training-hud-line">Mana Regen/s: <strong>{(training.manaRegenPerS ?? 0).toFixed(1)}</strong></div>
        </div>
      )}

      {debugMode && (
        <div className="training-hud-card training-hud-card--dev" aria-label="Developer actions">
          <div className="training-hud-title">Dev Panel (F3)</div>
          <div className="training-hud-line">Quick test actions</div>
          <div className="dev-hud-actions">
            <button type="button" className="dev-hud-btn" onClick={() => onDevAddGold?.()}>
              Add 100 Gold
            </button>
            <button type="button" className="dev-hud-btn" onClick={() => onDevLevelUp?.()}>
              Level Up Player
            </button>
            <button type="button" className="dev-hud-btn" onClick={() => onDevUnlockAllActs?.()}>
              Unlock All Acts
            </button>
          </div>
        </div>
      )}

      {equipment && !hidePaperdoll && (
        <div className={`equip-doll-mini${minimapMode === 1 ? ' equip-doll-mini--minimap-corner' : ''}`}>
          {/* Row 1 — Helmet */}
          <div className="doll-mini-row doll-mini-row--center">
            <MiniSlot slotKey="helmet"    entry={equipment.helmet}    onHover={setHoveredEquip} />
          </div>
          {/* Row 2 — Mainhand · Amulet · Offhand */}
          <div className="doll-mini-row">
            <MiniSlot slotKey="mainhand"  entry={equipment.mainhand}  onHover={setHoveredEquip} />
            <MiniSlot slotKey="amulet"    entry={equipment.amulet}    onHover={setHoveredEquip} />
            <MiniSlot slotKey="offhand"   entry={equipment.offhand}   onHover={setHoveredEquip} />
          </div>
          {/* Row 3 — Ring1 · Body · Ring2 */}
          <div className="doll-mini-row">
            <MiniSlot slotKey="ring1"     entry={equipment.ring1}     onHover={setHoveredEquip} />
            <MiniSlot slotKey="bodyarmor" entry={equipment.bodyarmor} onHover={setHoveredEquip} />
            <MiniSlot slotKey="ring2"     entry={equipment.ring2}     onHover={setHoveredEquip} />
          </div>
          {/* Row 4 — Gloves · Belt · Boots */}
          <div className="doll-mini-row">
            <MiniSlot slotKey="gloves"    entry={equipment.gloves}    onHover={setHoveredEquip} />
            <MiniSlot slotKey="belt"      entry={equipment.belt}      onHover={setHoveredEquip} />
            <MiniSlot slotKey="boots"     entry={equipment.boots}     onHover={setHoveredEquip} />
          </div>
          {/* Hover tooltip — appears to the left of the paperdoll */}
          {hoveredEquip && (
            <DollTooltip slotKey={hoveredEquip.slotKey} entry={hoveredEquip.entry} />
          )}
        </div>
      )}

      {!mobileMode && Array.isArray(potions) && potions.length > 0 && (
        <div className="potion-belt-hud" aria-label="Potion belt">
          {potions.map((p) => {
            const chargePct = p.maxCharges > 0 ? Math.max(0, Math.min(100, (p.charges / p.maxCharges) * 100)) : 0;
            const canUse = p.maxCharges > 0 && p.charges >= (p.chargesPerUse || 1);
            return (
              <div
                key={p.slot}
                className={`potion-slot${p.empty ? ' potion-slot--empty' : ''}${p.active ? ' potion-slot--active' : ''}${!canUse && !p.empty ? ' potion-slot--dry' : ''}`}
                title={`${p.name}${p.empty ? '' : ` (${Math.floor(p.charges)}/${p.maxCharges})`}`}
                onMouseEnter={(e) => {
                  if (p.empty) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredPotion({
                    potion: p,
                    pos: { x: rect.left + rect.width / 2, y: rect.top - 10 },
                  });
                }}
                onMouseLeave={() => setHoveredPotion(null)}
              >
                <span className="potion-slot-key">{p.hotkey}</span>
                <span className="potion-slot-icon" style={{ color: p.color }}>{p.icon}</span>
                <span className="potion-slot-name">{p.empty ? 'Empty' : p.name}</span>
                <div className="potion-slot-meter">
                  <div className="potion-slot-fill" style={{ width: `${chargePct}%`, background: p.color }} />
                </div>
                {p.active && <div className="potion-slot-active" style={{ width: `${Math.round((p.activePct ?? 0) * 100)}%` }} />}
              </div>
            );
          })}
        </div>
      )}

      {hoveredPotion?.potion && (
        <div className="hud-potion-tooltip" style={{ left: hoveredPotion.pos.x, top: hoveredPotion.pos.y }}>
          <div className="hud-potion-tooltip__name" style={{ color: hoveredPotion.potion.color }}>
            {hoveredPotion.potion.name}
          </div>
          <div className="hud-potion-tooltip__line">Charges: {Math.floor(hoveredPotion.potion.charges)}/{hoveredPotion.potion.maxCharges}</div>
          <div className="hud-potion-tooltip__line">Use Cost: {hoveredPotion.potion.chargesPerUse}</div>
          <div className="hud-potion-tooltip__line">Duration: {hoveredPotion.potion.duration?.toFixed?.(2) ?? '0.00'}s</div>
          {(hoveredPotion.potion.effectLines ?? []).map((line, idx) => (
            <div key={`${hoveredPotion.potion.id}_${idx}`} className="hud-potion-tooltip__line">{line}</div>
          ))}
          {hoveredPotion.potion.active && <div className="hud-potion-tooltip__active">Active</div>}
        </div>
      )}

      {!mobileMode && (
        <div className="hud-controls-hint">
          <span><kbd>Click</kbd> Interact</span>
          <span><kbd>1</kbd>/<kbd>2</kbd> Potions</span>
          <span><kbd>Space</kbd> Primary</span>
          <span><kbd>Q</kbd>/<kbd>E</kbd>/<kbd>R</kbd> Skills</span>
          <span><kbd>H</kbd> Minimap</span>
          <span><kbd>V</kbd> Inventory</span>
          <span><kbd>G</kbd> Gems</span>
          {(screenContext === 'HUB' || screenContext === 'RUNNING') && (
            <span className={skillPoints > 0 ? 'hud-tree-hint hud-tree-hint--ready' : 'hud-tree-hint'}>
              <kbd>T</kbd> Passive Tree {skillPoints > 0 ? `(${skillPoints})` : ''}
            </span>
          )}
          {mapContext && <span><kbd>B</kbd> Portal</span>}
        </div>
      )}

      {/* Active skill hotbar — Space / Q / E / R */}
      {showSkillHotbar && (
        <div className="skill-hotbar">
          {[primarySkill ?? null, ...(activeSkills ?? [])].map((s, i) => {
            const key = ['␣', 'Q', 'E', 'R'][i] ?? '?';
            const fillPct = s && !s.ready
              ? Math.max(0, ((s.cooldown - s.remaining) / s.cooldown) * 100)
              : 100;
            return (
              <div
                key={i}
                className={`skill-slot${s?.ready ? ' skill-slot--ready' : ''}${s && s.canAfford === false ? ' skill-slot--oom' : ''}${s?.blocked ? ' skill-slot--blocked' : ''}${!s ? ' skill-slot--empty' : ''}`}
                onMouseEnter={(e) => {
                  if (!s) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredSkill({
                    skill: s,
                    pos: { x: rect.left + rect.width / 2, y: rect.top - 10 },
                  });
                }}
                onMouseLeave={() => setHoveredSkill(null)}
              >
                <span className="skill-key">{key}</span>
                {s ? (
                  <>
                    <span className="skill-icon">{s.icon}</span>
                    <span className="skill-name">{s.name}</span>
                    {s.blockedReason && <span className="skill-requirement-flag">REQ</span>}
                    {!s.ready && s.remaining > 0 && (
                      <div className="skill-cd-bar">
                        <div className="skill-cd-fill" style={{ width: `${fillPct}%` }} />
                      </div>
                    )}
                  </>
                ) : (
                  <span className="skill-empty-label">empty</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hoveredSkill && (
        <SkillTooltip skill={hoveredSkill.skill} pos={hoveredSkill.pos} />
      )}
    </div>
  );
}

