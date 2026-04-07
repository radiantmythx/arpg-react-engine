/**
 * GemPanel — Phase 12.5 Support Gem socketing UI.
 *
 * Renders as an embedded panel body (no overlay wrapper).
 * Designed to be hosted inside InventoryScreen's "Gems" tab.
 *
 * Props:
 *   primarySkill    — serialized primary/default attack skill (Space)
 *   activeSkills    — serialized from ActiveSkillSystem.serialize()
 *   inventory       — { cols, rows, items[] } — used to find support gems
 *   onSocketGem(skillId, slotIndex, gemUid)
 *   onUnsocketGem(skillId, slotIndex)
 */
import { useState } from 'react';
import { SUPPORT_POOL, isSupportCompatible } from '../game/data/supports.js';
import { highlightElementalText } from './ElementalText.jsx';
import '../styles/GemPanel.css';

const GEM_RARITY_COLOR = '#4ecdc4'; // teal for support gems

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

/** A single socket diamond slot. */
function SocketSlot({ slotIndex, support, isOpen, skillTags, onSocket, onUnsocket, selectedGem }) {
  if (!isOpen) {
    return <div className="gem-socket gem-socket--locked" title="Unlock at higher skill level">🔒</div>;
  }

  const isCompatible = selectedGem
    ? isSupportCompatible(
        SUPPORT_POOL.find((s) => s.id === selectedGem.gemId) ?? {},
        skillTags,
      )
    : false;

  if (support) {
    return (
      <div
        className="gem-socket gem-socket--filled"
        title={`${support.name} — click to remove`}
        onClick={() => onUnsocket(slotIndex)}
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
        selectedGem && isCompatible ? 'gem-socket--target' : '',
        selectedGem && !isCompatible ? 'gem-socket--incompatible' : '',
      ].join(' ')}
      title={selectedGem ? (isCompatible ? 'Click to socket' : 'Incompatible') : 'Empty socket'}
      onClick={() => selectedGem && isCompatible && onSocket(slotIndex, selectedGem.uid)}
    >
      <span className="gem-socket-empty-icon">◆</span>
    </div>
  );
}

/** Compact skill row in the left list. */
function SkillRow({ skill, isSelected, onClick }) {
  const isMax = skill.isMaxLevel ?? false;
  const xpPct = isMax
    ? 100
    : skill.xpToNext > 0
      ? Math.min(100, Math.round(((skill.xp ?? 0) / skill.xpToNext) * 100))
      : 0;

  return (
    <div
      className={['gem-skill-row', isSelected ? 'gem-skill-row--selected' : '', isMax ? 'gem-skill-row--maxlevel' : ''].join(' ')}
      onClick={onClick}
    >
      <span className="gem-skill-icon">{skill.icon ?? '⚡'}</span>
      <div className="gem-skill-meta">
        <span className="gem-skill-name">{skill.name}</span>
        <span className="gem-skill-level">
          Lv {skill.level ?? 1}{isMax ? ' ✦ MAX' : ` / ${skill.maxLevel ?? 20}`}
        </span>
        {!isMax && (
          <div className="gem-skill-xpbar-bg">
            <div className="gem-skill-xpbar-fill" style={{ width: `${xpPct}%` }} />
          </div>
        )}
        {isMax && skill.maxLevelBonus && (
          <span className="gem-skill-maxbonus">{skill.maxLevelBonus}</span>
        )}
      </div>
      <div className="gem-skill-sockets">
        {(skill.supportSlots ?? [null]).map((s, i) => (
          <div
            key={i}
            className={['gem-mini-socket', s ? 'gem-mini-socket--filled' : ''].join(' ')}
            title={s?.name}
          />
        ))}
      </div>
    </div>
  );
}

export function GemPanel({ primarySkill, activeSkills, inventory, onSocketGem, onUnsocketGem, mobileMode = false }) {
  const [selectedSkillId, setSelectedSkillId] = useState(null);
  const [selectedGemUid, setSelectedGemUid]   = useState(null);
  const [mobileView, setMobileView] = useState('skills');

  // Extract support gems from inventory
  const stashGems = (inventory?.items ?? []).filter(
    (item) => item.type === 'support_gem' && item.gemId,
  );

  const skills = [
    ...(primarySkill ? [primarySkill] : []),
    ...((activeSkills ?? []).filter(Boolean)),
  ].filter((skill, index, arr) => arr.findIndex((s) => s.id === skill.id) === index);
  const activeSkill = skills.find((s) => s.id === selectedSkillId) ?? skills[0] ?? null;
  const selectedGem = stashGems.find((g) => g.uid === selectedGemUid) ?? null;

  const handleSocket = (slotIndex, gemUid) => {
    if (!activeSkill) return;
    pulse(10);
    onSocketGem(activeSkill.id, slotIndex, gemUid);
    setSelectedGemUid(null);
  };

  const handleUnsocket = (slotIndex) => {
    if (!activeSkill) return;
    pulse(8);
    onUnsocketGem(activeSkill.id, slotIndex);
  };

  const slots       = activeSkill?.supportSlots ?? [null];
  const openSlots   = activeSkill?.openSlots ?? slots.length;
  const skillTags   = activeSkill?.tags ?? [];

  return (
    <>
      {mobileMode && (
        <div className="gem-mobile-tabs">
          <button type="button" className={`gem-mobile-tab${mobileView === 'skills' ? ' gem-mobile-tab--active' : ''}`} onClick={() => setMobileView('skills')}>Skills</button>
          <button type="button" className={`gem-mobile-tab${mobileView === 'sockets' ? ' gem-mobile-tab--active' : ''}`} onClick={() => setMobileView('sockets')}>Sockets</button>
          <button type="button" className={`gem-mobile-tab${mobileView === 'stash' ? ' gem-mobile-tab--active' : ''}`} onClick={() => setMobileView('stash')}>Supports</button>
        </div>
      )}
      <div className={`gem-panel-body${mobileMode ? ' gem-panel-body--mobile' : ''}`}>
          {/* ── Left: Skill List ────────────────────────── */}
          <div className={`gem-skill-list${mobileMode && mobileView !== 'skills' ? ' gem-pane--hidden' : ''}`}>
            <p className="gem-section-label">SKILLS</p>
            {skills.length === 0 && (
              <p className="gem-empty-hint">No active skills equipped.</p>
            )}
            {skills.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                isSelected={skill.id === (activeSkill?.id)}
                onClick={() => {
                  pulse(8);
                  setSelectedSkillId(skill.id);
                  setSelectedGemUid(null);
                  if (mobileMode) setMobileView('sockets');
                }}
              />
            ))}
          </div>

          {/* ── Center: Socket Slots ─────────────────── */}
          <div className={`gem-socket-panel${mobileMode && mobileView !== 'sockets' ? ' gem-pane--hidden' : ''}`}>
            {activeSkill ? (
              <>
                <div className="gem-active-skill-header">
                  <span className="gem-active-icon">{activeSkill.icon ?? '⚡'}</span>
                  <div>
                    <p className="gem-active-name">{activeSkill.name}</p>
                    <p className="gem-active-desc">{highlightElementalText(activeSkill.description)}</p>
                    <div className="gem-tags">
                      {skillTags.map((t) => <TagBadge key={t} tag={t} />)}
                    </div>
                  </div>
                </div>

                <p className="gem-section-label">SOCKETS ({openSlots} / {slots.length})</p>
                {mobileMode && (
                  <p className="gem-mobile-hint">Tap a support gem, then tap an open socket. Tap a filled socket to remove it.</p>
                )}
                <div className="gem-socket-grid">
                  {slots.map((support, idx) => (
                    <SocketSlot
                      key={idx}
                      slotIndex={idx}
                      support={support}
                      isOpen={idx < openSlots}
                      skillTags={skillTags}
                      selectedGem={selectedGem}
                      onSocket={handleSocket}
                      onUnsocket={handleUnsocket}
                    />
                  ))}
                </div>

                {selectedGem && (
                  <div className="gem-selected-preview">
                    <span className="gem-selected-label">Selected:</span>
                    <span className="gem-selected-name" style={{ color: GEM_RARITY_COLOR }}>
                      {selectedGem.name}
                    </span>
                    <span className="gem-selected-hint">— click an empty socket to apply</span>
                    <button
                      className="gem-deselect-btn"
                      onClick={() => setSelectedGemUid(null)}
                    >
                      deselect
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="gem-empty-hint">Select a skill from the left panel.</p>
            )}
          </div>

          {/* ── Right: Gem Stash ─────────────────────── */}
          <div className={`gem-stash${mobileMode && mobileView !== 'stash' ? ' gem-pane--hidden' : ''}`}>
            <p className="gem-section-label">GEM STASH</p>
            {stashGems.length === 0 && (
              <p className="gem-empty-hint">No support gems in inventory.</p>
            )}
            {stashGems.map((gem) => {
              const def = SUPPORT_POOL.find((s) => s.id === gem.gemId);
              const isSelected = gem.uid === selectedGemUid;
              const compatible = activeSkill
                ? isSupportCompatible(def ?? {}, skillTags)
                : true;
              return (
                <div
                  key={gem.uid}
                  className={[
                    'gem-stash-item',
                    isSelected ? 'gem-stash-item--selected' : '',
                    !compatible ? 'gem-stash-item--incompatible' : '',
                  ].join(' ')}
                  title={def?.description ?? gem.name}
                  onClick={() => {
                    pulse(8);
                    setSelectedGemUid(isSelected ? null : gem.uid);
                    if (!isSelected && mobileMode) setMobileView('sockets');
                  }}
                >
                  <span className="gem-stash-icon">{def?.icon ?? '◆'}</span>
                  <div className="gem-stash-meta">
                    <span className="gem-stash-name" style={{ color: GEM_RARITY_COLOR }}>
                      {gem.name}
                    </span>
                    {def && (
                      <span className="gem-stash-desc">{highlightElementalText(def.description)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
      </div>
    </>
  );
}
