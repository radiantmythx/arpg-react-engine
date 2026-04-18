/**
 * GemPanel — gem socketing UI for the InventoryScreen Gems tab.
 *
 * Desktop uses cursor-held gems for click/drop placement.
 * Mobile uses tap selection from the shared inventory grid.
 */
import { useEffect, useState } from 'react';
import { SUPPORT_POOL, isSupportCompatible } from '../game/data/supports.js';
import { unlockLevelForSocketIndex } from '../game/supportSockets.js';
import { SUPPORT_TUNING } from '../game/content/tuning/supports.tuning.js';
import '../styles/GemPanel.css';

// Tag colors matching ailment system
const TAG_COLORS = {
  Spell:       '#a29bfe',
  Attack:      '#e17055',
  Projectile:  '#74b9ff',
  AoE:         '#fdcb6e',
  Fire:        '#e17055',
  Cold:        '#74b9ff',
  Lightning:   '#fdcb6e',
  Physical:    '#b2bec3',
  Chaos:       '#6c5ce7',
  Duration:    '#55efc4',
  Channelling: '#fd79a8',
  Melee:       '#e17055',
  Movement:    '#00b894',
  Minion:      '#a29bfe',
  default:     '#9e9e9e',
};

function pulse(ms = 10) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  navigator.vibrate(ms);
}

function getDraggedSkillGemUid(event) {
  const direct = event.dataTransfer?.getData('application/x-sre-skill-gem');
  if (direct) return direct;
  const plain = event.dataTransfer?.getData('text/plain') ?? '';
  if (plain.startsWith('skill_gem:')) return plain.slice('skill_gem:'.length);
  return null;
}

function getDraggedSupportGemUid(event) {
  const direct = event.dataTransfer?.getData('application/x-sre-support-gem');
  if (direct) return direct;
  const plain = event.dataTransfer?.getData('text/plain') ?? '';
  if (plain.startsWith('support_gem:')) return plain.slice('support_gem:'.length);
  return null;
}

function supportManaCostMultiplierFromSlots(slots = []) {
  let mult = 1;
  for (const sup of slots) {
    if (!sup?.id) continue;
    const one = SUPPORT_TUNING.manaCostMultiplierBySupportId?.[sup.id]
      ?? SUPPORT_TUNING.defaultManaCostMultiplier
      ?? 1;
    mult *= one;
  }
  return Math.max(0.1, mult);
}

function skillCanAcceptCursorGem(skill, cursorGem) {
  if (skill?._isPlaceholder) return false;
  if (!skill || !cursorGem) return false;
  const supportDef = SUPPORT_POOL.find((s) => s.id === cursorGem.gemId) ?? null;
  if (!supportDef) return false;
  const slots = skill.supportSlots ?? [null];
  const openSlots = skill.openSlots ?? slots.length;
  const hasRoom = slots.slice(0, openSlots).some((slot) => !slot);
  return hasRoom && isSupportCompatible(supportDef, skill.tags ?? []);
}

/** A single support socket slot (target for drag-drop). */
function SocketSlot({ skillId, slotIndex, support, isOpen, skillTags, cursorGem, onSocketGem, onUnsocketGem, isPlaceholder = false, mobileMode = false, onHoverTooltip, onClearTooltip }) {
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) {
    const lockTitle = isPlaceholder
      ? 'Equip a skill gem in this slot to enable sockets.'
      : `Unlocks at level ${unlockLevelForSocketIndex(slotIndex)}`;
    return (
      <div
        className="gem-socket gem-socket--locked"
        title={lockTitle}
      >
        🔒
      </div>
    );
  }

  const isCompatible = cursorGem
    ? isSupportCompatible(
        SUPPORT_POOL.find((s) => s.id === cursorGem.gemId) ?? {},
        skillTags,
      )
    : false;
    const canTarget = !support && !!cursorGem && isCompatible;

  if (support) {
    const supportDef = SUPPORT_POOL.find((s) => s.id === support.id) ?? null;
    const manaCostMult = SUPPORT_TUNING.manaCostMultiplierBySupportId?.[support.id]
      ?? SUPPORT_TUNING.defaultManaCostMultiplier
      ?? 1;
    const reservationMult = SUPPORT_TUNING.defaultReservationMultiplier ?? 1;
    const tooltipData = {
      name: `${support.name} Support`,
      rarity: 'magic',
      slot: 'support_gem',
      description: supportDef?.description ?? 'Support modifier linked to this skill.',
      baseStats: { manaCostMult, reservationMult },
      affixes: [],
    };
    return (
      <div
        className={[
          'gem-socket gem-socket--filled',
          cursorGem && isCompatible ? 'gem-socket--target' : '',
          dragOver ? 'gem-socket--target' : '',
        ].join(' ')}
        title={cursorGem && isCompatible ? `${support.name} — click to replace` : `${support.name} — click to remove`}
        onClick={() => {
          if (cursorGem && isCompatible) {
            onSocketGem(skillId, slotIndex, cursorGem, { toCursorExisting: !mobileMode });
            return;
          }
          onUnsocketGem(skillId, slotIndex, { toCursor: !mobileMode });
        }}
        onDragOver={(e) => {
          const draggedUid = getDraggedSupportGemUid(e);
          if (!draggedUid || !isCompatible) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          const draggedUid = getDraggedSupportGemUid(e);
          setDragOver(false);
          if (!draggedUid || !isCompatible) return;
          e.preventDefault();
          onSocketGem(skillId, slotIndex, draggedUid, { toCursorExisting: true });
        }}
        onMouseEnter={(e) => onHoverTooltip?.(tooltipData, e)}
        onMouseMove={(e) => onHoverTooltip?.(tooltipData, e)}
        onMouseLeave={() => onClearTooltip?.()}
      >
        <span className="gem-socket-icon">{support.icon ?? '◆'}</span>
        <span className="gem-socket-name">{support.name}</span>
      </div>
    );
  }

  return (
    <div
      className={[
        'gem-socket gem-socket--empty',
        canTarget || dragOver ? 'gem-socket--target' : '',
        cursorGem && !isCompatible ? 'gem-socket--incompatible' : '',
      ].join(' ')}
      title={cursorGem ? (isCompatible ? 'Place support gem in this socket' : 'Incompatible support gem') : 'Drop or pick up a support gem, then place it here'}
      onClick={cursorGem && isCompatible ? () => onSocketGem?.(skillId, slotIndex, cursorGem) : undefined}
      onDragOver={(e) => {
        const draggedUid = getDraggedSupportGemUid(e);
        if (!draggedUid) return;
        if (support || !isCompatible) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        const draggedUid = getDraggedSupportGemUid(e);
        setDragOver(false);
        if (!draggedUid) return;
        if (support || !isCompatible) return;
        e.preventDefault();
        onSocketGem?.(skillId, slotIndex, draggedUid);
      }}
    >
      <span className="gem-socket-empty-icon">◆</span>
    </div>
  );
}

/** Skill row for paperdoll (left side). */
function SkillSocket({ skill, cursorGem, cursorSkillGem, onSocketGem, onUnsocketGem, onEquipSkillGem, onUnequipSkillGem, onClearSelectedSkillGem, onDebugLevelUpSkillGem, debugMode = false, mobileMode = false, isFocused = false, isSuggested = false, onHoverTooltip, onClearTooltip }) {
  const [dragOverSkillTarget, setDragOverSkillTarget] = useState(false);
  const isMax = skill.isMaxLevel ?? false;
  const xpPct = isMax
    ? 100
    : skill.xpToNext > 0
      ? Math.min(100, Math.round(((skill.xp ?? 0) / skill.xpToNext) * 100))
      : 0;

  const skillTags = skill.tags ?? [];
  const slots = skill.supportSlots ?? [null];
  const openSlots = skill.openSlots ?? slots.length;

  const effectiveManaCost = Math.max(0, Math.round(skill.manaCost ?? 0));
  const supportManaMult = supportManaCostMultiplierFromSlots(slots.slice(0, openSlots));
  const skillTooltipData = {
    name: skill.name,
    rarity: 'magic',
    slot: 'skill_gem',
    description: skill.description,
    baseStats: {
      manaCost: effectiveManaCost,
      manaCostMult: supportManaMult,
      reservationMult: skill.reservationMult ?? 1,
    },
    affixes: [],
  };
  const blockedReason = skill.blockedReason ?? null;
  const requirementHint = skill.requirementHint ?? null;

  const canDropSkillGem = !!skill._slotKey;

  const equipOrReplaceSkillGem = (gemSource) => {
    if (!gemSource || !skill._slotKey) return;
    onEquipSkillGem?.(skill._slotKey, gemSource);
    onClearSelectedSkillGem?.();
  };

  const handleSkillSlotActivate = () => {
    if (!skill._slotKey) return;
    if (cursorSkillGem) {
      equipOrReplaceSkillGem(cursorSkillGem);
      return;
    }
    if (!skill._isPlaceholder) {
      onUnequipSkillGem?.(skill._slotKey, { toCursor: !mobileMode });
    }
  };

  return (
    <div className={[
      'gem-skill-socket-block',
      mobileMode ? 'gem-skill-socket-block--mobile' : '',
      isFocused ? 'gem-skill-socket-block--focused' : '',
      isSuggested ? 'gem-skill-socket-block--suggested' : '',
      skill.blocked ? 'gem-skill-socket-block--blocked' : '',
      dragOverSkillTarget ? 'gem-skill-socket-block--drop-target' : '',
    ].filter(Boolean).join(' ')}>
      {/* ── Single row: icon | info | sockets ── */}
      <div
        className="gem-skill-main-row"
        onMouseEnter={(e) => !mobileMode && onHoverTooltip?.(skillTooltipData, e)}
        onMouseMove={(e) => !mobileMode && onHoverTooltip?.(skillTooltipData, e)}
        onMouseLeave={() => !mobileMode && onClearTooltip?.()}
      >
        <div
          className={[
            'gem-skill-icon-slot',
            skill._isPlaceholder ? 'gem-skill-icon-slot--empty' : 'gem-skill-icon-slot--filled',
            cursorSkillGem && canDropSkillGem ? 'gem-skill-icon-slot--ready' : '',
            dragOverSkillTarget ? 'gem-skill-icon-slot--target' : '',
          ].filter(Boolean).join(' ')}
          onClick={(e) => {
            e.stopPropagation();
            handleSkillSlotActivate();
          }}
          onDragOver={(e) => {
            if (!canDropSkillGem) return;
            const uid = getDraggedSkillGemUid(e);
            if (!uid) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverSkillTarget(true);
          }}
          onDragLeave={() => setDragOverSkillTarget(false)}
          onDrop={(e) => {
            if (!canDropSkillGem) return;
            const uid = getDraggedSkillGemUid(e);
            setDragOverSkillTarget(false);
            if (!uid) return;
            e.preventDefault();
            equipOrReplaceSkillGem(uid);
          }}
          title={skill._isPlaceholder
            ? (cursorSkillGem ? 'Click to equip held skill gem' : 'Empty skill socket')
            : (cursorSkillGem ? 'Click to replace with held skill gem' : 'Click to unequip skill gem')}
        >
          <span className="gem-skill-icon-slot-glyph">{skill._isPlaceholder ? '◇' : (skill.icon ?? '⚡')}</span>
        </div>

        <div className="gem-skill-info">
          <span className="gem-skill-slot-label">{skill._slotLabel ?? 'Skill'}</span>
          <span className="gem-skill-name">{skill.name}</span>
          <span className="gem-skill-level">
            Lv {skill.level ?? 1}{isMax ? ' ✦' : ` / ${skill.maxLevel ?? 20}`}
          </span>
          {blockedReason && <span className="gem-skill-requirement">{blockedReason}</span>}
          {requirementHint && <span className="gem-skill-requirement-hint">{requirementHint}</span>}
          {debugMode && !skill._isPlaceholder && (
            <button
              type="button"
              className="gem-skill-debug-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDebugLevelUpSkillGem?.(skill._slotKey);
              }}
            >
              +1 Level (Debug)
            </button>
          )}
        </div>

        {/* Support sockets — same row as skill info */}
        <div className="gem-socket-row">
          {slots.map((support, idx) => (
            <SocketSlot
              key={idx}
              skillId={skill.id}
              slotIndex={idx}
              support={support}
              isOpen={idx < openSlots}
              skillTags={skillTags}
              cursorGem={cursorGem}
              onSocketGem={onSocketGem}
              onUnsocketGem={onUnsocketGem}
              isPlaceholder={skill._isPlaceholder}
              mobileMode={mobileMode}
              onHoverTooltip={onHoverTooltip}
              onClearTooltip={onClearTooltip}
            />
          ))}
        </div>
      </div>

      {/* XP bar spans the full width of the block */}
      {!isMax && (
        <div className="gem-skill-xpbar-bg">
          <div className="gem-skill-xpbar-fill" style={{ width: `${xpPct}%` }} />
        </div>
      )}
    </div>
  );
}
export function GemPanel({ primarySkill, activeSkills, cursorItem, selectedSupportGem, selectedSkillGem, onClearSelectedGem, onClearSelectedSkillGem, onSocketGem, onUnsocketGem, onEquipSkillGem, onUnequipSkillGem, debugMode = false, onDebugLevelUpSkillGem, mobileMode = false, onHoverTooltip, onClearTooltip }) {
  const [selectedSkillId, setSelectedSkillId] = useState(null);

  const makePlaceholder = (slotKey, slotLabel) => ({
    id: `empty_${slotKey}`,
    name: `${slotLabel} Slot`,
    icon: slotLabel === 'Primary' ? '␣' : slotLabel,
    description: 'No skill gem equipped. Equip a skill gem to enable sockets in this slot.',
    tags: [],
    supportSlots: Array(5).fill(null),
    openSlots: 0,
    level: 1,
    maxLevel: 20,
    _isPlaceholder: true,
    _slotKey: slotKey,
    _slotLabel: slotLabel,
  });

  const slotModels = [
    { slotKey: 'primary', slotLabel: 'Primary', skill: primarySkill ?? null },
    { slotKey: 'q', slotLabel: 'Q', skill: activeSkills?.[0] ?? null },
    { slotKey: 'e', slotLabel: 'E', skill: activeSkills?.[1] ?? null },
    { slotKey: 'r', slotLabel: 'R', skill: activeSkills?.[2] ?? null },
  ];

  const skills = slotModels.map(({ slotKey, slotLabel, skill }) => {
    if (!skill) return makePlaceholder(slotKey, slotLabel);
    return {
      ...skill,
      _slotKey: slotKey,
      _slotLabel: slotLabel,
      _isPlaceholder: false,
    };
  });

  useEffect(() => {
    if (!skills.length) {
      setSelectedSkillId(null);
      return;
    }
    if (!skills.some((skill) => skill.id === selectedSkillId)) {
      setSelectedSkillId(skills[0].id);
    }
  }, [skills, selectedSkillId]);

  const cursorGem = mobileMode
    ? (selectedSupportGem ?? null)
    : (cursorItem?.type === 'support_gem' ? cursorItem : (selectedSupportGem ?? null));
  const cursorSkillGem = mobileMode
    ? (selectedSkillGem ?? null)
    : (cursorItem?.type === 'skill_gem' ? cursorItem : (selectedSkillGem ?? null));
  const focusedSkill = mobileMode
    ? (skills.find((skill) => skill.id === selectedSkillId) ?? skills[0] ?? null)
    : null;
  const visibleSkills = mobileMode ? (focusedSkill ? [focusedSkill] : []) : skills;
  const blockedSkills = skills.filter((skill) => !skill._isPlaceholder && skill.blocked);
  const requirementHints = [...new Set(blockedSkills.map((skill) => skill.requirementHint).filter(Boolean))];

  const handleSocketGem = (skillId, slotIndex, gemUid) => {
    if (!skillId?.startsWith?.('empty_')) {
      pulse(10);
      onSocketGem(skillId, slotIndex, gemUid);
      onClearSelectedGem?.();
    }
  };

  const handleUnsocketGem = (skillId, slotIndex) => {
    pulse(8);
    onUnsocketGem(skillId, slotIndex);
  };

  return (
    <div className={`gem-panel-body gem-panel-body--paperdoll${mobileMode ? ' gem-panel-body--mobile' : ''}`}>
      <div className="gem-doll-wrap">
        <p className="gem-section-label">SKILLS & SOCKETS</p>

        {mobileMode ? (
          <div className={`gem-flow-card${cursorGem ? ' gem-flow-card--selected' : ''}`}>
            <div className="gem-flow-step">{cursorGem ? 'Step 2 · Link the selected support' : 'Link Skills view'}</div>
            <p className="gem-mobile-hint">
              {cursorGem ? (
                <>
                  Selected support gem: <span className="gem-selected-name">{cursorGem.name}</span>. Switch skills below and tap a glowing compatible socket.
                </>
              ) : cursorSkillGem ? (
                <>
                  Selected skill gem: <span className="gem-selected-name">{cursorSkillGem.name}</span>. Tap a slot action to equip it.
                </>
              ) : (
                'No support gem is selected yet. Use the Support Gems view to choose one first, then come back here to attach it.'
              )}
            </p>
            {(cursorGem || cursorSkillGem) && (
              <button
                type="button"
                className="gem-flow-clear"
                onClick={() => {
                  onClearSelectedGem?.();
                  onClearSelectedSkillGem?.();
                }}
              >
                Clear Selection
              </button>
            )}
          </div>
        ) : cursorGem ? (
          <p className="gem-desktop-hint">
            Held support gem: <span className="gem-selected-name">{cursorGem.name}</span> (click or drop into compatible socket)
          </p>
        ) : (
          <p className="gem-desktop-hint">
            {cursorSkillGem
              ? <>Held skill gem: <span className="gem-selected-name">{cursorSkillGem.name}</span> (click or drop into a skill slot)</>
              : 'Click a skill or support gem to pick it up, then click or drop it into a skill/support socket.'}
          </p>
        )}

        {blockedSkills.length > 0 && (
          <div className="gem-gate-summary">
            <div className="gem-gate-summary__title">
              {blockedSkills.length} skill gate{blockedSkills.length === 1 ? '' : 's'} active
            </div>
            <div className="gem-gate-summary__copy">
              {blockedSkills.map((skill) => `${skill._slotLabel}: ${skill.blockedReason}`).join(' · ')}
            </div>
            {requirementHints.map((hint, index) => (
              <div key={`${hint}-${index}`} className="gem-gate-summary__hint">{hint}</div>
            ))}
          </div>
        )}

        {mobileMode && skills.length > 1 && (
          <div className="gem-skill-switcher">
            {skills.map((skill) => {
              const suggested = skillCanAcceptCursorGem(skill, cursorGem);
              return (
                <button
                  key={skill._slotKey}
                  type="button"
                  className={`gem-skill-chip${focusedSkill?.id === skill.id ? ' gem-skill-chip--active' : ''}${suggested ? ' gem-skill-chip--suggested' : ''}`}
                  onClick={() => setSelectedSkillId(skill.id)}
                >
                  <span className="gem-skill-chip-icon">{skill.icon ?? '⚡'}</span>
                  <span>{skill._slotLabel}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className={`gem-doll${mobileMode ? ' gem-doll--mobile' : ''}`}>
          {visibleSkills.map((skill) => (
            <SkillSocket
              key={skill._slotKey}
              skill={skill}
              cursorGem={cursorGem}
              cursorSkillGem={cursorSkillGem}
              onSocketGem={handleSocketGem}
              onUnsocketGem={handleUnsocketGem}
              onEquipSkillGem={onEquipSkillGem}
              onUnequipSkillGem={onUnequipSkillGem}
              onClearSelectedSkillGem={onClearSelectedSkillGem}
              onDebugLevelUpSkillGem={onDebugLevelUpSkillGem}
              debugMode={debugMode}
              mobileMode={mobileMode}
              isFocused={!mobileMode || focusedSkill?.id === skill.id}
              isSuggested={skillCanAcceptCursorGem(skill, cursorGem)}
              onHoverTooltip={onHoverTooltip}
              onClearTooltip={onClearTooltip}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
