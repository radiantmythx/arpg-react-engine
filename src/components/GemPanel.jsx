/**
 * GemPanel — support socketing UI driven by inventory selection.
 *
 * Designed to be hosted in InventoryScreen's Gems tab.
 * Player selects a support gem from the shared inventory grid,
 * then clicks a compatible socket here.
 */
import { useEffect, useState } from 'react';
import { SUPPORT_POOL, isSupportCompatible } from '../game/data/supports.js';
import { highlightElementalText } from './ElementalText.jsx';
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

function TagBadge({ tag }) {
  const color = TAG_COLORS[tag] ?? TAG_COLORS.default;
  return (
    <span className="gem-tag-badge" style={{ borderColor: color, color }}>
      {tag}
    </span>
  );
}

function skillCanAcceptCursorGem(skill, cursorGem) {
  if (!skill || !cursorGem) return false;
  const supportDef = SUPPORT_POOL.find((s) => s.id === cursorGem.gemId) ?? null;
  if (!supportDef) return false;
  const slots = skill.supportSlots ?? [null];
  const openSlots = skill.openSlots ?? slots.length;
  const hasRoom = slots.slice(0, openSlots).some((slot) => !slot);
  return hasRoom && isSupportCompatible(supportDef, skill.tags ?? []);
}

/** A single support socket slot (target for drag-drop). */
function SocketSlot({ skillId, slotIndex, support, isOpen, skillTags, cursorGem, onSocketGem, onUnsocketGem }) {
  if (!isOpen) {
    return <div className="gem-socket gem-socket--locked" title="Unlock at higher skill level">🔒</div>;
  }

  const isCompatible = cursorGem
    ? isSupportCompatible(
        SUPPORT_POOL.find((s) => s.id === cursorGem.gemId) ?? {},
        skillTags,
      )
    : false;

  if (support) {
    return (
      <div
        className="gem-socket gem-socket--filled"
        title={`${support.name} — click to remove`}
        onClick={() => onUnsocketGem(skillId, slotIndex)}
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
        cursorGem && isCompatible ? 'gem-socket--target' : '',
        cursorGem && !isCompatible ? 'gem-socket--incompatible' : '',
      ].join(' ')}
      title={cursorGem ? (isCompatible ? 'Click to socket selected gem' : 'Incompatible selected gem') : 'Select a support gem from inventory'}
      onClick={cursorGem && isCompatible ? () => onSocketGem?.(skillId, slotIndex, cursorGem.uid) : undefined}
    >
      <span className="gem-socket-empty-icon">◆</span>
    </div>
  );
}

/** Skill row for paperdoll (left side). */
function SkillSocket({ skill, cursorGem, onSocketGem, onUnsocketGem, mobileMode = false, isFocused = false, isSuggested = false }) {
  const isMax = skill.isMaxLevel ?? false;
  const xpPct = isMax
    ? 100
    : skill.xpToNext > 0
      ? Math.min(100, Math.round(((skill.xp ?? 0) / skill.xpToNext) * 100))
      : 0;

  const skillTags = skill.tags ?? [];
  const slots = skill.supportSlots ?? [null];
  const openSlots = skill.openSlots ?? slots.length;

  return (
    <div className={[
      'gem-skill-socket-block',
      mobileMode ? 'gem-skill-socket-block--mobile' : '',
      isFocused ? 'gem-skill-socket-block--focused' : '',
      isSuggested ? 'gem-skill-socket-block--suggested' : '',
    ].filter(Boolean).join(' ')}>
      <div className="gem-skill-compact">
        <div className="gem-skill-header">
          <span className="gem-skill-icon">{skill.icon ?? '⚡'}</span>
          <div className="gem-skill-info">
            <span className="gem-skill-name">{skill.name}</span>
            <span className="gem-skill-level">
              Lv {skill.level ?? 1}{isMax ? ' ✦' : ` / ${skill.maxLevel ?? 20}`}
            </span>
            {!isMax && (
              <div className="gem-skill-xpbar-bg">
                <div className="gem-skill-xpbar-fill" style={{ width: `${xpPct}%` }} />
              </div>
            )}
          </div>
        </div>

        <div className="gem-skill-hovercard" role="tooltip">
          <div className="gem-skill-hovercard-name">{skill.name}</div>
          <div className="gem-skill-hovercard-level">
            Level {skill.level ?? 1}{isMax ? ' (MAX)' : ` / ${skill.maxLevel ?? 20}`}
          </div>
          <p className="gem-skill-hovercard-desc">{highlightElementalText(skill.description)}</p>
          <div className="gem-tags-row">
            {skillTags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        </div>
      </div>

      {/* Socket slots grid */}
      <div className="gem-sockets-label">Sockets ({openSlots} / {slots.length})</div>
      <div className="gem-socket-grid">
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
          />
        ))}
      </div>
    </div>
  );
}
export function GemPanel({ primarySkill, activeSkills, selectedSupportGem, onClearSelectedGem, onSocketGem, onUnsocketGem, mobileMode = false }) {
  const [selectedSkillId, setSelectedSkillId] = useState(null);

  const skills = [
    ...(primarySkill ? [primarySkill] : []),
    ...((activeSkills ?? []).filter(Boolean)),
  ].filter((skill, index, arr) => arr.findIndex((s) => s.id === skill.id) === index);

  useEffect(() => {
    if (!skills.length) {
      setSelectedSkillId(null);
      return;
    }
    if (!skills.some((skill) => skill.id === selectedSkillId)) {
      setSelectedSkillId(skills[0].id);
    }
  }, [skills, selectedSkillId]);

  const cursorGem = selectedSupportGem ?? null;
  const focusedSkill = mobileMode
    ? (skills.find((skill) => skill.id === selectedSkillId) ?? skills[0] ?? null)
    : null;
  const visibleSkills = mobileMode ? (focusedSkill ? [focusedSkill] : []) : skills;

  const handleSocketGem = (skillId, slotIndex, gemUid) => {
    pulse(10);
    onSocketGem(skillId, slotIndex, gemUid);
    onClearSelectedGem?.();
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
              ) : (
                'No support gem is selected yet. Use the Support Gems view to choose one first, then come back here to attach it.'
              )}
            </p>
            {cursorGem && (
              <button type="button" className="gem-flow-clear" onClick={() => onClearSelectedGem?.()}>
                Clear Selection
              </button>
            )}
          </div>
        ) : cursorGem ? (
          <p className="gem-desktop-hint">
            Selected support gem: <span className="gem-selected-name">{cursorGem.name}</span> (click compatible socket to apply)
          </p>
        ) : (
          <p className="gem-desktop-hint">
            Select a support gem from inventory (from either tab), then click a compatible socket.
          </p>
        )}

        {mobileMode && skills.length > 1 && (
          <div className="gem-skill-switcher">
            {skills.map((skill) => {
              const suggested = skillCanAcceptCursorGem(skill, cursorGem);
              return (
                <button
                  key={skill.id}
                  type="button"
                  className={`gem-skill-chip${focusedSkill?.id === skill.id ? ' gem-skill-chip--active' : ''}${suggested ? ' gem-skill-chip--suggested' : ''}`}
                  onClick={() => setSelectedSkillId(skill.id)}
                >
                  <span className="gem-skill-chip-icon">{skill.icon ?? '⚡'}</span>
                  <span>{skill.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {skills.length === 0 ? (
          <p className="gem-empty-hint">No active skills equipped.</p>
        ) : (
          <div className={`gem-doll${mobileMode ? ' gem-doll--mobile' : ''}`}>
            {visibleSkills.map((skill) => (
              <SkillSocket
                key={skill.id}
                skill={skill}
                cursorGem={cursorGem}
                onSocketGem={handleSocketGem}
                onUnsocketGem={handleUnsocketGem}
                mobileMode={mobileMode}
                isFocused={!mobileMode || focusedSkill?.id === skill.id}
                isSuggested={skillCanAcceptCursorGem(skill, cursorGem)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
