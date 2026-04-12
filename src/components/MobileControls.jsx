import { useEffect, useRef, useState } from 'react';

const STICK_DEADZONE = 0.18;
const TOUCH_MOUSE_GUARD_MS = 450;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Renders a single skill-aware combat button (Attack / Q / E / R). */
function SkillButton({ label, skill, className = '', onTouchStart, onTouchEnd, onTouchCancel, onMouseDown, onMouseUp, onMouseLeave }) {
  const ready = skill?.ready ?? false;
  const canAfford = skill?.canAfford !== false;
  const onCooldown = skill && !ready && (skill.remaining ?? 0) > 0;
  const fillPct = onCooldown
    ? Math.max(0, ((skill.cooldown - skill.remaining) / skill.cooldown) * 100)
    : 100;

  let stateClass = '';
  if (skill) {
    if (ready) stateClass = ' mobile-skill-btn--ready';
    else if (!canAfford) stateClass = ' mobile-skill-btn--oom';
    else stateClass = ' mobile-skill-btn--cooling';
  }

  return (
    <button
      type="button"
      className={`mobile-btn mobile-skill-btn${stateClass}${className ? ` ${className}` : ''}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      <span className="mobile-skill-key-label">{label}</span>
      {skill ? (
        <>
          <span className="mobile-skill-icon">{skill.icon}</span>
          {onCooldown && (
            <div className="mobile-skill-cd-bar">
              <div className="mobile-skill-cd-fill" style={{ width: `${fillPct}%` }} />
            </div>
          )}
        </>
      ) : (
        <span className="mobile-skill-empty">—</span>
      )}
    </button>
  );
}

export function MobileControls({
  onMove,
  onPrimaryHold,
  onSkillTap,
  onOpenInventory,
  onOpenGems,
  onOpenTree,
  onOpenSheet,
  onPause,
  onPortal,
  onToggleLock,
  lockActive = false,
  leftHanded = false,
  largeButtons = false,
  hapticsEnabled = true,
  autoPickupEnabled = true,
  onToggleHandedness,
  onToggleButtonSize,
  onToggleHaptics,
  onToggleAutoPickup,
  showCombatButtons = true,
  showSheetButton = false,
  compactMode = false,
  primarySkill = null,
  activeSkills = [],
  potions = [],
  onUsePotion,
  minimapMode = 0,
  onCycleMinimap,
}) {
  const stickRef = useRef(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });
  const activeTouchId = useRef(null);
  const lastTouchAt = useRef(0);

  useEffect(() => {
    return () => {
      onMove(0, 0);
      onPrimaryHold(false);
    };
  }, [onMove, onPrimaryHold]);

  const updateStickFromTouch = (touch) => {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dxPx = touch.clientX - cx;
    const dyPx = touch.clientY - cy;
    const maxR = rect.width * 0.34;
    const len = Math.hypot(dxPx, dyPx);
    const scale = len > maxR && len > 0 ? maxR / len : 1;
    let nx = clamp((dxPx * scale) / maxR, -1, 1);
    let ny = clamp((dyPx * scale) / maxR, -1, 1);
    const nLen = Math.hypot(nx, ny);
    if (nLen < STICK_DEADZONE) {
      nx = 0;
      ny = 0;
    }

    setThumb({ x: nx, y: ny });
    onMove(nx, ny);
  };

  const pulse = (ms = 12) => {
    if (!hapticsEnabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
    navigator.vibrate(ms);
  };

  const invokeTouch = (fn, hapticMs = 10) => (e) => {
    e.preventDefault();
    lastTouchAt.current = Date.now();
    pulse(hapticMs);
    fn();
  };

  const invokeMouse = (fn) => (e) => {
    if (Date.now() - lastTouchAt.current < TOUCH_MOUSE_GUARD_MS) {
      e.preventDefault();
      return;
    }
    fn();
  };

  const resetStick = () => {
    activeTouchId.current = null;
    setThumb({ x: 0, y: 0 });
    onMove(0, 0);
  };

  const onStickStart = (e) => {
    e.preventDefault();
    const t = e.changedTouches?.[0];
    if (!t) return;
    lastTouchAt.current = Date.now();
    activeTouchId.current = t.identifier;
    pulse(8);
    updateStickFromTouch(t);
  };

  const onStickMove = (e) => {
    e.preventDefault();
    if (activeTouchId.current == null) return;
    const t = Array.from(e.changedTouches ?? []).find((x) => x.identifier === activeTouchId.current);
    if (!t) return;
    updateStickFromTouch(t);
  };

  const onStickEnd = (e) => {
    e.preventDefault();
    const ended = Array.from(e.changedTouches ?? []).some((x) => x.identifier === activeTouchId.current);
    if (ended) resetStick();
  };

  const qSkill = activeSkills?.[0] ?? null;
  const eSkill = activeSkills?.[1] ?? null;
  const rSkill = activeSkills?.[2] ?? null;
  const minimapLabel = minimapMode === 3 ? 'Map Mini' : minimapMode === 2 ? 'Map Full' : 'Map Off';
  const minimapActive = minimapMode !== 0;

  return (
    <div className={`mobile-controls-layer${leftHanded ? ' mobile-controls-layer--left-handed' : ''}${largeButtons ? ' mobile-controls-layer--large' : ''}${compactMode ? ' mobile-controls-layer--compact' : ''}`} aria-hidden>
      {/* Joystick */}
      <div
        ref={stickRef}
        className="mobile-stick"
        onTouchStart={onStickStart}
        onTouchMove={onStickMove}
        onTouchEnd={onStickEnd}
        onTouchCancel={onStickEnd}
      >
        <div
          className="mobile-stick-thumb"
          style={{ transform: `translate(${thumb.x * 30}px, ${thumb.y * 30}px)` }}
        />
      </div>

      {/* Minimap toggle button above the joystick */}
      <div className="mobile-minimap-toggle">
        <button
          type="button"
          className={`mobile-btn mobile-btn--tiny${minimapActive ? ' mobile-btn--active' : ''}`}
          onTouchStart={invokeTouch(() => onCycleMinimap?.(), 8)}
          onMouseDown={invokeMouse(() => onCycleMinimap?.())}
        >
          {minimapLabel}
        </button>
      </div>

      {showCombatButtons && (
        <div className="mobile-combat-buttons">
          {/* Row 1: Attack + Lock */}
          <SkillButton
            label="␣"
            skill={primarySkill}
            className="mobile-skill-btn--primary"
            onTouchStart={invokeTouch(() => onPrimaryHold(true), 14)}
            onTouchEnd={invokeTouch(() => onPrimaryHold(false), 0)}
            onTouchCancel={invokeTouch(() => onPrimaryHold(false), 0)}
            onMouseDown={invokeMouse(() => onPrimaryHold(true))}
            onMouseUp={invokeMouse(() => onPrimaryHold(false))}
            onMouseLeave={invokeMouse(() => onPrimaryHold(false))}
          />
          <button
            type="button"
            className={`mobile-btn mobile-btn--lock${lockActive ? ' mobile-btn--active' : ''}`}
            onTouchStart={invokeTouch(onToggleLock, 12)}
            onMouseDown={invokeMouse(onToggleLock)}
          >
            {compactMode ? '🎯' : 'Lock'}
          </button>

          {/* Row 2: Q + E */}
          <SkillButton
            label="Q"
            skill={qSkill}
            onTouchStart={invokeTouch(() => onSkillTap('q'), 12)}
            onMouseDown={invokeMouse(() => onSkillTap('q'))}
          />
          <SkillButton
            label="E"
            skill={eSkill}
            onTouchStart={invokeTouch(() => onSkillTap('e'), 12)}
            onMouseDown={invokeMouse(() => onSkillTap('e'))}
          />

          {/* Row 3: R + Portal */}
          <SkillButton
            label="R"
            skill={rSkill}
            onTouchStart={invokeTouch(() => onSkillTap('r'), 12)}
            onMouseDown={invokeMouse(() => onSkillTap('r'))}
          />
          <button
            type="button"
            className="mobile-btn mobile-btn--portal"
            onTouchStart={invokeTouch(onPortal, 12)}
            onMouseDown={invokeMouse(onPortal)}
          >
            {compactMode ? '🚪' : 'Portal'}
          </button>

          {/* Row 4: 4 potion slots spanning full width */}
          <div className="mobile-potion-row">
            {[0, 1, 2, 3].map((i) => {
              const p = potions?.[i];
              const empty = !p || p.empty;
              const canUse = !empty && p.charges >= (p.chargesPerUse || 1);
              const chargePct = (!empty && p.maxCharges > 0)
                ? Math.max(0, Math.min(100, (p.charges / p.maxCharges) * 100))
                : 0;
              return (
                <button
                  key={i}
                  type="button"
                  className={`mobile-btn mobile-btn--potion${empty ? ' mobile-btn--potion-empty' : ''}${p?.active ? ' mobile-btn--active' : ''}${!canUse && !empty ? ' mobile-btn--potion-dry' : ''}`}
                  onTouchStart={invokeTouch(() => !empty && onUsePotion?.(i), 10)}
                  onMouseDown={invokeMouse(() => !empty && onUsePotion?.(i))}
                >
                  <span className="mobile-potion-key">{i + 1}</span>
                  {!empty ? (
                    <>
                      <span className="mobile-potion-icon" style={{ color: p.color }}>{p.icon}</span>
                      <div className="mobile-potion-meter">
                        <div className="mobile-potion-fill" style={{ width: `${chargePct}%`, background: p.color }} />
                      </div>
                      {p.active && <div className="mobile-potion-active-bar" />}
                    </>
                  ) : (
                    <span className="mobile-potion-hollow">·</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mobile-utility-buttons">
        <button type="button" className="mobile-btn mobile-btn--small" onTouchStart={invokeTouch(onOpenInventory, 10)} onMouseDown={invokeMouse(onOpenInventory)}>{compactMode ? '🎒' : 'Inv'}</button>
        <button type="button" className="mobile-btn mobile-btn--small" onTouchStart={invokeTouch(onOpenGems, 10)} onMouseDown={invokeMouse(onOpenGems)}>{compactMode ? '💎' : 'Gems'}</button>
        <button type="button" className="mobile-btn mobile-btn--small" onTouchStart={invokeTouch(onOpenTree, 10)} onMouseDown={invokeMouse(onOpenTree)}>{compactMode ? '🌳' : 'Tree'}</button>
        {showSheetButton && (
          <button type="button" className="mobile-btn mobile-btn--small" onTouchStart={invokeTouch(onOpenSheet, 10)} onMouseDown={invokeMouse(onOpenSheet)}>{compactMode ? '📜' : 'Sheet'}</button>
        )}
        <button type="button" className="mobile-btn mobile-btn--small" onTouchStart={invokeTouch(onPause, 10)} onMouseDown={invokeMouse(onPause)}>{compactMode ? '⏸' : 'Pause'}</button>
      </div>

      {!compactMode && (
      <div className="mobile-settings-buttons">
        <button type="button" className={`mobile-btn mobile-btn--tiny${leftHanded ? ' mobile-btn--active' : ''}`} onTouchStart={invokeTouch(onToggleHandedness, 8)} onMouseDown={invokeMouse(onToggleHandedness)}>Swap</button>
        <button type="button" className={`mobile-btn mobile-btn--tiny${largeButtons ? ' mobile-btn--active' : ''}`} onTouchStart={invokeTouch(onToggleButtonSize, 8)} onMouseDown={invokeMouse(onToggleButtonSize)}>Large</button>
        <button type="button" className={`mobile-btn mobile-btn--tiny${hapticsEnabled ? ' mobile-btn--active' : ''}`} onTouchStart={invokeTouch(onToggleHaptics, 8)} onMouseDown={invokeMouse(onToggleHaptics)}>Vibe</button>
        {onToggleAutoPickup && (
          <button type="button" className={`mobile-btn mobile-btn--tiny${autoPickupEnabled ? ' mobile-btn--active' : ''}`} onTouchStart={invokeTouch(onToggleAutoPickup, 8)} onMouseDown={invokeMouse(onToggleAutoPickup)}>Loot+</button>
        )}
      </div>
      )}
    </div>
  );
}
