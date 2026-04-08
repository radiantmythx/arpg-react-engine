/**
 * GemPanel — support socketing UI driven by inventory selection.
 *
 * Designed to be hosted in InventoryScreen's Gems tab.
 * Player selects a support gem from the shared inventory grid,
 * then clicks a compatible socket here.
 */
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
function SkillSocket({ skill, cursorGem, onSocketGem, onUnsocketGem }) {
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
    <div className="gem-skill-socket-block">
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
export function GemPanel({ primarySkill, activeSkills, selectedSupportGem, onClearSelectedGem, onSocketGem, onUnsocketGem }) {

  const skills = [
    ...(primarySkill ? [primarySkill] : []),
    ...((activeSkills ?? []).filter(Boolean)),
  ].filter((skill, index, arr) => arr.findIndex((s) => s.id === skill.id) === index);

  const cursorGem = selectedSupportGem ?? null;

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
    <div className="gem-panel-body gem-panel-body--paperdoll">
      <div className="gem-doll-wrap">
        <p className="gem-section-label">SKILLS & SOCKETS</p>
        {cursorGem ? (
          <p className="gem-desktop-hint">
            Selected support gem: <span className="gem-selected-name">{cursorGem.name}</span> (click compatible socket to apply)
          </p>
        ) : (
          <p className="gem-desktop-hint">
            Select a support gem from inventory (from either tab), then click a compatible socket.
          </p>
        )}
        {skills.length === 0 ? (
          <p className="gem-empty-hint">No active skills equipped.</p>
        ) : (
          <div className="gem-doll">
            {skills.map((skill) => (
              <SkillSocket
                key={skill.id}
                skill={skill}
                cursorGem={cursorGem}
                onSocketGem={handleSocketGem}
                onUnsocketGem={handleUnsocketGem}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
