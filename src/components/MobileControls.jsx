import { useEffect, useRef, useState } from 'react';

const STICK_DEADZONE = 0.18;
const TOUCH_MOUSE_GUARD_MS = 450;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
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

  return (
    <div className={`mobile-controls-layer${leftHanded ? ' mobile-controls-layer--left-handed' : ''}${largeButtons ? ' mobile-controls-layer--large' : ''}`} aria-hidden>
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

      {showCombatButtons && (
        <div className="mobile-combat-buttons">
          <button
            type="button"
            className="mobile-btn mobile-btn--primary"
            onTouchStart={invokeTouch(() => onPrimaryHold(true), 14)}
            onTouchEnd={invokeTouch(() => onPrimaryHold(false), 0)}
            onTouchCancel={invokeTouch(() => onPrimaryHold(false), 0)}
            onMouseDown={invokeMouse(() => onPrimaryHold(true))}
            onMouseUp={invokeMouse(() => onPrimaryHold(false))}
            onMouseLeave={invokeMouse(() => onPrimaryHold(false))}
          >
            Primary
          </button>
          <button type="button" className={`mobile-btn mobile-btn--lock${lockActive ? ' mobile-btn--active' : ''}`} onTouchStart={invokeTouch(onToggleLock, 12)} onMouseDown={invokeMouse(onToggleLock)}>Lock</button>
          <button type="button" className="mobile-btn" onTouchStart={invokeTouch(() => onSkillTap('q'), 12)} onMouseDown={invokeMouse(() => onSkillTap('q'))}>Q</button>
          <button type="button" className="mobile-btn" onTouchStart={invokeTouch(() => onSkillTap('e'), 12)} onMouseDown={invokeMouse(() => onSkillTap('e'))}>E</button>
          <button type="button" className="mobile-btn" onTouchStart={invokeTouch(() => onSkillTap('r'), 12)} onMouseDown={invokeMouse(() => onSkillTap('r'))}>R</button>
        </div>
      )}

      <div className="mobile-utility-buttons">
        <button type="button" className="mobile-btn mobile-btn--small" onTouchStart={invokeTouch(onOpenInventory, 10)} onMouseDown={invokeMouse(onOpenInventory)}>Inv</button>
        <button type="button" className="mobile-btn mobile-btn--small" onTouchStart={invokeTouch(onOpenGems, 10)} onMouseDown={invokeMouse(onOpenGems)}>Gems</button>
        <button type="button" className="mobile-btn mobile-btn--small" onTouchStart={invokeTouch(onOpenTree, 10)} onMouseDown={invokeMouse(onOpenTree)}>Tree</button>
        {showSheetButton && (
          <button type="button" className="mobile-btn mobile-btn--small" onTouchStart={invokeTouch(onOpenSheet, 10)} onMouseDown={invokeMouse(onOpenSheet)}>Sheet</button>
        )}
        <button type="button" className="mobile-btn mobile-btn--small" onTouchStart={invokeTouch(onPause, 10)} onMouseDown={invokeMouse(onPause)}>Pause</button>
      </div>

      <div className="mobile-settings-buttons">
        <button type="button" className={`mobile-btn mobile-btn--tiny${leftHanded ? ' mobile-btn--active' : ''}`} onTouchStart={invokeTouch(onToggleHandedness, 8)} onMouseDown={invokeMouse(onToggleHandedness)}>Swap</button>
        <button type="button" className={`mobile-btn mobile-btn--tiny${largeButtons ? ' mobile-btn--active' : ''}`} onTouchStart={invokeTouch(onToggleButtonSize, 8)} onMouseDown={invokeMouse(onToggleButtonSize)}>Large</button>
        <button type="button" className={`mobile-btn mobile-btn--tiny${hapticsEnabled ? ' mobile-btn--active' : ''}`} onTouchStart={invokeTouch(onToggleHaptics, 8)} onMouseDown={invokeMouse(onToggleHaptics)}>Vibe</button>
        {onToggleAutoPickup && (
          <button type="button" className={`mobile-btn mobile-btn--tiny${autoPickupEnabled ? ' mobile-btn--active' : ''}`} onTouchStart={invokeTouch(onToggleAutoPickup, 8)} onMouseDown={invokeMouse(onToggleAutoPickup)}>Loot+</button>
        )}
      </div>
    </div>
  );
}
