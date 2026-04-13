/**
 * PassiveTreeScreen — full-screen SVG passive skill tree overlay.
 *
 * The tree renders in a 3600×3600 SVG viewBox with desktop wheel-zoom/drag-pan
 * and mobile pinch/drag-to-pan.
 *
 * Node visual states:
 *   allocated — gold/bright, shows allocation glow
 *   available — steel-blue, pulsing ring (adjacent to allocated + cost <= skillPoints)
 *   locked    — dark gray, not clickable
 *
 * Node shapes (all radii in 3600×3600 SVG coordinate space):
 *   minor    — circle r=40
 *   notable  — circle r=64
 *   mastery  — octagon r=76
 *   keystone — rotated square (diamond) r≈88
 *
 * Props:
 *   allocatedIds  — array of allocated node ids (converted to Set internally)
 *   skillPoints   — number of unspent skill points
 *   onAllocate(id) — called when player clicks an available node
 *   onClose        — called when player closes the tree
 */
import { useEffect, useRef, useState } from 'react';
import { PASSIVE_TREE_NODES, TREE_NODE_MAP, TREE_EDGES } from '../game/data/passiveTree.js';

// Node radii in SVG coordinate space (3600×3600 viewBox — all values ×4 from original 900×900)
const NODE_RADIUS = { minor: 40, notable: 64, mastery: 76, keystone: 88 };

// State → fill color per type
const FILL = {
  minor:    { allocated: '#f1c40f', available: '#4a7fb5', locked: '#1e1e2e' },
  notable:  { allocated: '#f39c12', available: '#2980b9', locked: '#16162a' },
  mastery:  { allocated: '#c084fc', available: '#7e3ba2', locked: '#1a142e' },
  keystone: { allocated: '#e74c3c', available: '#c0392b', locked: '#14142a' },
};

const STROKE = {
  allocated: 'rgba(255,255,255,0.55)',
  available: 'rgba(107,156,212,0.6)',
  locked:    'transparent',
};

const MIN_MOBILE_ZOOM   = 0.8;
const MAX_MOBILE_ZOOM   = 5;
const DEFAULT_MOBILE_ZOOM = 3.5;
const MIN_DESKTOP_ZOOM  = 0.3;
const MAX_DESKTOP_ZOOM  = 3.0;
const DEFAULT_DESKTOP_ZOOM = 1.0;

function clampMobileZoom(v)  { return Math.max(MIN_MOBILE_ZOOM,  Math.min(MAX_MOBILE_ZOOM,  v)); }
function clampDesktopZoom(v) { return Math.max(MIN_DESKTOP_ZOOM, Math.min(MAX_DESKTOP_ZOOM, v)); }

/** Generate SVG points string for an octagon centred at (cx, cy) with circumradius r. */
function octagonPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function getNodeState(id, allocatedSet, skillPoints) {
  if (allocatedSet.has(id)) return 'allocated';
  const node = TREE_NODE_MAP[id];
  if (!node) return 'locked';
  const adjacent = node.connections.some((cid) => allocatedSet.has(cid));
  if (adjacent && skillPoints > 0) return 'available';
  return 'locked';
}

function NodeShape({ node, state }) {
  const r      = NODE_RADIUS[node.type] ?? NODE_RADIUS.minor;
  const fill   = (FILL[node.type] ?? FILL.minor)[state];
  const stroke = STROKE[state];
  const { x, y } = node.position;

  if (node.type === 'mastery') {
    return (
      <polygon
        points={octagonPoints(x, y, r)}
        fill={fill}
        stroke={stroke}
        strokeWidth={6}
      />
    );
  }
  if (node.type === 'keystone') {
    const s = r * 1.35;
    return (
      <rect
        x={x - s / 2} y={y - s / 2}
        width={s}      height={s}
        rx={12}
        fill={fill}
        stroke={stroke}
        strokeWidth={6}
        transform={`rotate(45, ${x}, ${y})`}
      />
    );
  }
  return (
    <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={6} />
  );
}

export function PassiveTreeScreen({ allocatedIds, skillPoints, onAllocate, onClose, mobileMode = false }) {
  const allocatedSet = new Set(allocatedIds);
  const [hovered, setHovered]       = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(DEFAULT_MOBILE_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const suppressNodeTapUntilRef = useRef(0);

  // Desktop pan / zoom state
  const [desktopZoom, setDesktopZoom] = useState(DEFAULT_DESKTOP_ZOOM);
  const [desktopPan,  setDesktopPan]  = useState({ x: 0, y: 0 });
  const [isDesktopDragging, setIsDesktopDragging] = useState(false);
  const desktopDragRef  = useRef(null);
  // Refs so the non-passive wheel handler can read latest values without re-registering
  const desktopZoomRef  = useRef(DEFAULT_DESKTOP_ZOOM);
  const desktopPanRef   = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!mobileMode) return;
    const fallbackId = TREE_NODE_MAP.start ? 'start' : (PASSIVE_TREE_NODES[0]?.id ?? null);
    if (!selectedNodeId && fallbackId) {
      setSelectedNodeId(fallbackId);
    }
  }, [mobileMode, selectedNodeId]);

  // Keep refs in sync so the non-passive wheel handler always sees latest values
  useEffect(() => { desktopZoomRef.current = desktopZoom; }, [desktopZoom]);
  useEffect(() => { desktopPanRef.current  = desktopPan;  }, [desktopPan]);

  // Non-passive wheel zoom for desktop (must be registered imperatively)
  useEffect(() => {
    if (mobileMode) return;
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const zoomNow = desktopZoomRef.current;
      const panNow  = desktopPanRef.current;
      const factor  = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = clampDesktopZoom(zoomNow * factor);
      const rect    = el.getBoundingClientRect();
      const cx      = e.clientX - rect.left  - rect.width  / 2;
      const cy      = e.clientY - rect.top   - rect.height / 2;
      const scale   = newZoom / zoomNow;
      setDesktopZoom(newZoom);
      setDesktopPan({
        x: cx - scale * (cx - panNow.x),
        y: cy - scale * (cy - panNow.y),
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [mobileMode]);

  const centerOnNode = (node, nextZoom = zoom) => {
    const container = containerRef.current;
    if (!container || !node) return;
    const rect = container.getBoundingClientRect();
    const baseSize = Math.min(rect.width - 12, rect.height - 12, 820);
    const offsetY = mobileMode ? Math.round(rect.height * -0.08) : 0;
    const relativeX = ((node.position.x / 3600) - 0.5) * baseSize;
    const relativeY = ((node.position.y / 3600) - 0.5) * baseSize;
    setPan({
      x: Math.round(-(relativeX * nextZoom)),
      y: Math.round(offsetY - (relativeY * nextZoom)),
    });
  };

  const handleSvgMouseMove = (e) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleZoomChange = (delta) => {
    const nextZoom = clampMobileZoom(zoom + delta);
    setZoom(nextZoom);
    if (mobileMode && selectedNodeId && typeof window !== 'undefined') {
      const node = TREE_NODE_MAP[selectedNodeId];
      if (node) {
        window.requestAnimationFrame(() => centerOnNode(node, nextZoom));
      }
    }
  };

  const resetMobileView = () => {
    setZoom(DEFAULT_MOBILE_ZOOM);
    setSelectedNodeId(TREE_NODE_MAP.start ? 'start' : (PASSIVE_TREE_NODES[0]?.id ?? null));
    setPan({ x: 0, y: 0 });
  };

  // Desktop pan handlers
  const handleDesktopPanStart = (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    desktopDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: desktopPan.x,
      panY: desktopPan.y,
      moved: false,
    };
    setIsDesktopDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleDesktopPanMove = (e) => {
    const drag = desktopDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    setDesktopPan({ x: drag.panX + dx, y: drag.panY + dy });
  };

  const handleDesktopPanEnd = (e) => {
    const drag = desktopDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.moved) suppressNodeTapUntilRef.current = Date.now() + 150;
    desktopDragRef.current = null;
    setIsDesktopDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Unified container pointer handlers (dispatch to mobile or desktop)
  const handleContainerPointerDown   = (e) => mobileMode ? handlePanStart(e)  : handleDesktopPanStart(e);
  const handleContainerPointerMove   = (e) => mobileMode ? handlePanMove(e)   : handleDesktopPanMove(e);
  const handleContainerPointerUp     = (e) => mobileMode ? handlePanEnd(e)    : handleDesktopPanEnd(e);
  const handleContainerPointerCancel = (e) => mobileMode ? handlePanEnd(e)    : handleDesktopPanEnd(e);

  const handlePanStart = (e) => {
    if (!mobileMode) return;
    if (e.target.closest('.tree-mobile-sheet') || e.target.closest('.tree-mobile-toolbar')) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePanMove = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.moved = true;
    }
    setPan({ x: drag.panX + dx, y: drag.panY + dy });
  };

  const handlePanEnd = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.moved) {
      suppressNodeTapUntilRef.current = Date.now() + 250;
    }
    dragRef.current = null;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const handleNodeClick = (id) => {
    if (Date.now() < suppressNodeTapUntilRef.current) return;
    const node = TREE_NODE_MAP[id];
    if (!node) return;
    setSelectedNodeId(id);
    if (mobileMode) {
      setHovered(node);
      centerOnNode(node);
      return;
    }
    if (getNodeState(id, allocatedSet, skillPoints) === 'available') {
      onAllocate(id);
    }
  };

  // Build a description of what stats the node grants for the tooltip
  const statLines = (node) => {
    const lines = [];
    const s = node.stats;
    if (s.damageMult !== undefined) {
      const pct = Math.round((s.damageMult - 1) * 100);
      lines.push(pct >= 0 ? `+${pct}% weapon damage` : `${pct}% weapon damage`);
    }
    if (s.cooldownMult !== undefined) {
      const pct = Math.round((1 - s.cooldownMult) * 100);
      lines.push(`−${pct}% weapon cooldown`);
    }
    if (s.speedFlat !== undefined) {
      lines.push(s.speedFlat >= 0 ? `+${s.speedFlat} movement speed` : `${s.speedFlat} movement speed`);
    }
    if (s.maxHealthFlat !== undefined) {
      lines.push(s.maxHealthFlat >= 0 ? `+${s.maxHealthFlat} maximum life` : `${s.maxHealthFlat} maximum life`);
    }
    if (s.maxManaFlat !== undefined) {
      lines.push(s.maxManaFlat >= 0 ? `+${s.maxManaFlat} maximum mana` : `${s.maxManaFlat} maximum mana`);
    }
    if (s.healthRegenPerS !== undefined) {
      const v = s.healthRegenPerS;
      lines.push(v >= 0 ? `+${v} HP regenerated per second` : `${v} HP per second (drain)`);
    }
    if (s.manaRegenPerS !== undefined) {
      const v = s.manaRegenPerS;
      lines.push(v >= 0 ? `+${v} mana regenerated per second` : `${v} mana per second`);
    }
    if (s.pickupRadiusFlat !== undefined) {
      lines.push(`+${s.pickupRadiusFlat} pickup radius`);
    }
    if (s.xpMultiplier !== undefined) {
      const pct = Math.round((s.xpMultiplier - 1) * 100);
      lines.push(pct >= 0 ? `+${pct}% experience gained` : `${pct}% experience gained`);
    }
    if (s.manaCostMult !== undefined) {
      const pct = Math.round((1 - s.manaCostMult) * 100);
      lines.push(pct >= 0 ? `−${pct}% mana costs` : `+${Math.abs(pct)}% mana costs`);
    }
    if (s.projectileCountBonus !== undefined) {
      lines.push(`+${s.projectileCountBonus} projectile${s.projectileCountBonus > 1 ? 's' : ''}`);
    }
    // ── New stat keys (PT-0B) ────────────────────────────────────────────
    if (s.armorFlat !== undefined) {
      lines.push(s.armorFlat >= 0 ? `+${s.armorFlat} armor` : `${s.armorFlat} armor`);
    }
    if (s.evasionFlat !== undefined) {
      lines.push(s.evasionFlat >= 0 ? `+${s.evasionFlat} evasion` : `${s.evasionFlat} evasion`);
    }
    if (s.critChanceFlat !== undefined) {
      lines.push(s.critChanceFlat >= 0 ? `+${s.critChanceFlat}% critical chance` : `${s.critChanceFlat}% critical chance`);
    }
    if (s.critMultFlat !== undefined) {
      lines.push(s.critMultFlat >= 0 ? `+${s.critMultFlat}% critical multiplier` : `${s.critMultFlat}% critical multiplier`);
    }
    if (s.blazeDamageMult !== undefined) {
      const pct = Math.round((s.blazeDamageMult - 1) * 100);
      lines.push(pct >= 0 ? `+${pct}% Blaze damage` : `${pct}% Blaze damage`);
    }
    if (s.thunderDamageMult !== undefined) {
      const pct = Math.round((s.thunderDamageMult - 1) * 100);
      lines.push(pct >= 0 ? `+${pct}% Thunder damage` : `${pct}% Thunder damage`);
    }
    if (s.frostDamageMult !== undefined) {
      const pct = Math.round((s.frostDamageMult - 1) * 100);
      lines.push(pct >= 0 ? `+${pct}% Frost damage` : `${pct}% Frost damage`);
    }
    if (s.holyDamageMult !== undefined) {
      const pct = Math.round((s.holyDamageMult - 1) * 100);
      lines.push(pct >= 0 ? `+${pct}% Holy damage` : `${pct}% Holy damage`);
    }
    if (s.unholyDamageMult !== undefined) {
      const pct = Math.round((s.unholyDamageMult - 1) * 100);
      lines.push(pct >= 0 ? `+${pct}% Unholy damage` : `${pct}% Unholy damage`);
    }
    if (s.physDamageMult !== undefined) {
      const pct = Math.round((s.physDamageMult - 1) * 100);
      lines.push(pct >= 0 ? `+${pct}% Physical damage` : `${pct}% Physical damage`);
    }
    if (s.igniteChanceFlat !== undefined) lines.push(`+${s.igniteChanceFlat}% Ignite chance`);
    if (s.shockChanceFlat  !== undefined) lines.push(`+${s.shockChanceFlat}% Shock chance`);
    if (s.chillChanceFlat  !== undefined) lines.push(`+${s.chillChanceFlat}% Chill chance`);
    if (s.freezeChanceFlat !== undefined) lines.push(`+${s.freezeChanceFlat}% Freeze chance`);
    if (s.aoeSizeFlat !== undefined) {
      lines.push(s.aoeSizeFlat >= 0 ? `+${s.aoeSizeFlat} AoE radius` : `${s.aoeSizeFlat} AoE radius`);
    }
    if (s.skillDurationMult !== undefined) {
      const pct = Math.round((s.skillDurationMult - 1) * 100);
      lines.push(pct >= 0 ? `+${pct}% skill duration` : `${pct}% skill duration`);
    }
    if (s.lifeOnKillFlat !== undefined) lines.push(`+${s.lifeOnKillFlat} life on kill`);
    if (s.manaOnKillFlat !== undefined) lines.push(`+${s.manaOnKillFlat} mana on kill`);
    if (s.goldDropMult !== undefined) {
      const pct = Math.round((s.goldDropMult - 1) * 100);
      lines.push(pct >= 0 ? `+${pct}% gold dropped` : `${pct}% gold dropped`);
    }
    if (s.dashCooldownMult !== undefined) {
      const pct = Math.round((1 - s.dashCooldownMult) * 100);
      lines.push(pct >= 0 ? `\u2212${pct}% dash cooldown` : `+${Math.abs(pct)}% dash cooldown`);
    }
    if (s.energyShieldFlat !== undefined) {
      lines.push(s.energyShieldFlat >= 0 ? `+${s.energyShieldFlat} energy shield` : `${s.energyShieldFlat} energy shield`);
    }
    if (s.energyShieldRegenPerS !== undefined) {
      const v = s.energyShieldRegenPerS;
      lines.push(v >= 0 ? `+${v} energy shield per second` : `${v} energy shield per second`);
    }
    return lines;
  };

  const detailNode = mobileMode ? (TREE_NODE_MAP[selectedNodeId] ?? hovered) : hovered;
  const detailState = detailNode ? getNodeState(detailNode.id, allocatedSet, skillPoints) : 'locked';
  const detailLines = detailNode ? statLines(detailNode) : [];
  const isLandscapeMobile = mobileMode
    && typeof window !== 'undefined'
    && window.innerWidth > window.innerHeight;

  const treeSvgView = (
    <div
      ref={containerRef}
      className={`tree-svg-container${mobileMode ? ' tree-svg-container--mobile' : ''}${isDragging || isDesktopDragging ? ' tree-svg-container--dragging' : ''}`}
      onMouseMove={mobileMode ? undefined : handleSvgMouseMove}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerCancel={handleContainerPointerCancel}
    >
      <div
        className="tree-svg-pan"
        style={{ transform: `translate3d(${mobileMode ? pan.x : desktopPan.x}px, ${mobileMode ? pan.y : desktopPan.y}px, 0)` }}
      >
        <svg
          viewBox="0 0 3600 3600"
          preserveAspectRatio="xMidYMid meet"
          className="tree-svg"
          style={{ transform: `scale(${mobileMode ? zoom : desktopZoom})`, transformOrigin: 'center center' }}
        >
        {/* ── Allocated edge glow pass ─────────────────────────── */}
        {TREE_EDGES.map(({ a, b }) => {
          if (!allocatedSet.has(a) || !allocatedSet.has(b)) return null;
          const na = TREE_NODE_MAP[a];
          const nb = TREE_NODE_MAP[b];
          if (!na || !nb) return null;
          return (
            <line
              key={`glow-${a}||${b}`}
              x1={na.position.x} y1={na.position.y}
              x2={nb.position.x} y2={nb.position.y}
              stroke="#f1c40f"
              strokeWidth={32}
              opacity={0.12}
              strokeLinecap="round"
            />
          );
        })}

        {/* ── Connection lines ─────────────────────────────────── */}
        {TREE_EDGES.map(({ a, b }) => {
          const na = TREE_NODE_MAP[a];
          const nb = TREE_NODE_MAP[b];
          if (!na || !nb) return null;
          const bothAllocated = allocatedSet.has(a) && allocatedSet.has(b);
          const eitherAvailable =
            getNodeState(a, allocatedSet, skillPoints) === 'available' ||
            getNodeState(b, allocatedSet, skillPoints) === 'available';
          const stroke   = bothAllocated ? '#f1c40f'
                         : eitherAvailable ? '#3a5f82'
                         : '#2a2a3a';
          const sw = bothAllocated ? 12 : 6;
          const opacity = stroke === '#2a2a3a' ? 0.45 : 1;
          return (
            <line
              key={`${a}||${b}`}
              x1={na.position.x} y1={na.position.y}
              x2={nb.position.x} y2={nb.position.y}
              stroke={stroke}
              strokeWidth={sw}
              opacity={opacity}
            />
          );
        })}

        {/* ── Nodes ─────────────────────────────────────────────── */}
        {PASSIVE_TREE_NODES.map((node) => {
          const state     = getNodeState(node.id, allocatedSet, skillPoints);
          const r         = NODE_RADIUS[node.type] ?? NODE_RADIUS.minor;
          const isAvail   = state === 'available';
          const isAlloc   = state === 'allocated';
          const isSelected = selectedNodeId === node.id;
          const { x, y }  = node.position;

          return (
            <g
              key={node.id}
              className={`tree-node tree-node--${state}`}
              onClick={() => handleNodeClick(node.id)}
              onMouseEnter={() => setHovered(node)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: isAvail ? 'pointer' : 'default' }}
            >
              {/* Outer glow ring */}
              {(isAlloc || isAvail || isSelected) && (
                <circle
                  cx={x} cy={y} r={r + 24}
                  fill="none"
                  stroke={isSelected ? '#8bd3ff' : (isAlloc ? '#f1c40f' : '#4a7fb5')}
                  strokeWidth={isSelected ? 8 : 4}
                  opacity={isSelected ? 0.65 : (isAlloc ? 0.35 : 0.22)}
                />
              )}

              {/* Pulse ring (available only) */}
              {isAvail && (
                <circle
                  cx={x} cy={y} r={r + 16}
                  fill="none"
                  stroke="#6b9cd4"
                  strokeWidth={6}
                  className="tree-pulse"
                />
              )}

              {/* Node shape */}
              <NodeShape node={node} state={state} />

              {/* Labels — notable, mastery, and keystone only */}
              {(node.type === 'notable' || node.type === 'mastery' || node.type === 'keystone') && (
                <text
                  x={x}
                  y={y + r + 52}
                  textAnchor="middle"
                  fill={state === 'locked' ? '#484860' : '#d0d0e0'}
                  fontSize={node.type === 'keystone' ? 40 : node.type === 'mastery' ? 38 : 36}
                  fontWeight="700"
                  fontFamily="'Courier New', Courier, monospace"
                  pointerEvents="none"
                  letterSpacing="2"
                >
                  {node.label}
                </text>
              )}
            </g>
          );
        })}
        </svg>
      </div>
    </div>
  );

  return (
    <div className={`tree-overlay${mobileMode ? ' tree-overlay--mobile' : ''}${isLandscapeMobile ? ' tree-overlay--mobile-landscape' : ''}`} onContextMenu={(e) => e.preventDefault()}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="tree-header">
        <div className="tree-header-left">
          <span className="tree-title">PASSIVE SKILL TREE</span>
        </div>
        <div className="tree-header-center">
          {skillPoints > 0 ? (
            <span className="tree-points-badge">
              {skillPoints} skill point{skillPoints > 1 ? 's' : ''} available
            </span>
          ) : (
            <span className="tree-points-zero">
              {mobileMode ? 'No points available - level up to earn more.' : 'No points available - press [T] or level up'}
              {mobileMode && (
                <span className="tree-points-guide">Tap a node to focus it. Drag on the tree to pan.</span>
              )}
            </span>
          )}
        </div>
        <div className="tree-header-right">
          <button
            className={`btn tree-close-btn${mobileMode ? ' tree-close-btn--mobile' : ''}`}
            onClick={onClose}
            aria-label={mobileMode ? 'Close passive tree' : undefined}
          >
            {mobileMode ? '✕' : '✕ Close [T]'}
          </button>
        </div>
      </div>

      {mobileMode && (
        <div className="tree-mobile-toolbar">
          <span className="tree-mobile-toolbar__hint">Drag to pan · zoom in farther for tiny clusters.</span>
          <div className="tree-mobile-zoom">
            <button type="button" className="tree-mobile-zoom-btn" onClick={() => handleZoomChange(-0.2)} aria-label="Zoom out">−</button>
            <span className="tree-mobile-zoom-label">{Math.round(zoom * 100)}%</span>
            <button type="button" className="tree-mobile-zoom-btn" onClick={() => handleZoomChange(0.2)} aria-label="Zoom in">+</button>
            <button type="button" className="tree-mobile-zoom-btn tree-mobile-zoom-btn--reset" onClick={resetMobileView}>Reset</button>
          </div>
        </div>
      )}

      {/* ── SVG Tree ─────────────────────────────────────────────── */}
      {mobileMode && isLandscapeMobile ? (
        <div className="tree-mobile-layout">
          {treeSvgView}
          {detailNode && (
            <div className="tree-mobile-sheet tree-mobile-sheet--landscape">
              <div className={`tree-tt-type tree-tt-type--${detailNode.type}`}>
                {detailNode.type.toUpperCase()}
              </div>
              <div className="tree-tt-name">{detailNode.label}</div>
              <div className="tree-tt-desc">{detailNode.description}</div>
              {detailLines.length > 0 && (
                <ul className="tree-tt-stats">
                  {detailLines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
              {detailState === 'available' ? (
                <button className="btn btn-primary tree-mobile-allocate" onClick={() => onAllocate(detailNode.id)}>
                  Allocate Node
                </button>
              ) : detailState === 'allocated' ? (
                <div className="tree-mobile-status tree-mobile-status--done">Allocated</div>
              ) : (
                <div className="tree-mobile-status">Connect to this node and spend a point to unlock it.</div>
              )}
            </div>
          )}
        </div>
      ) : (
        treeSvgView
      )}

      {/* ── Tooltip ───────────────────────────────────────────────── */}
      {!mobileMode && hovered && (
        <div
          className="tree-tooltip"
          style={{
            left: Math.min(tooltipPos.x + 14, window.innerWidth  - 270),
            top:  Math.min(tooltipPos.y + 14, window.innerHeight - 220),
          }}
        >
          <div className={`tree-tt-type tree-tt-type--${hovered.type}`}>
            {hovered.type.toUpperCase()}
          </div>
          <div className="tree-tt-name">{hovered.label}</div>
          <div className="tree-tt-desc">{hovered.description}</div>

          {statLines(hovered).length > 0 && (
            <ul className="tree-tt-stats">
              {statLines(hovered).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}

          {getNodeState(hovered.id, allocatedSet, skillPoints) === 'available' && (
            <div className="tree-tt-hint">Click to allocate · costs 1 point</div>
          )}
          {getNodeState(hovered.id, allocatedSet, skillPoints) === 'allocated' && (
            <div className="tree-tt-hint tree-tt-hint--done">✓ Allocated</div>
          )}
          {getNodeState(hovered.id, allocatedSet, skillPoints) === 'locked' &&
            allocatedSet.size > 0 && skillPoints <= 0 && (
            <div className="tree-tt-hint tree-tt-hint--locked">Requires a skill point</div>
          )}
        </div>
      )}

      {mobileMode && detailNode && !isLandscapeMobile && (
        <div className="tree-mobile-sheet">
          <div className={`tree-tt-type tree-tt-type--${detailNode.type}`}>
            {detailNode.type.toUpperCase()}
          </div>
          <div className="tree-tt-name">{detailNode.label}</div>
          <div className="tree-tt-desc">{detailNode.description}</div>
          {detailLines.length > 0 && (
            <ul className="tree-tt-stats">
              {detailLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          {detailState === 'available' ? (
            <button className="btn btn-primary tree-mobile-allocate" onClick={() => onAllocate(detailNode.id)}>
              Allocate Node
            </button>
          ) : detailState === 'allocated' ? (
            <div className="tree-mobile-status tree-mobile-status--done">✓ Allocated</div>
          ) : (
            <div className="tree-mobile-status">Connect to this node and spend a point to unlock it.</div>
          )}
        </div>
      )}

      {/* ── Legend ───────────────────────────────────────────────── */}
      <div className="tree-legend">
        <span className="tree-legend-item tree-legend-minor">Minor</span>
        <span className="tree-legend-item tree-legend-notable">Notable</span>
          <span className="tree-legend-item tree-legend-mastery">Mastery</span>
          <span className="tree-legend-item tree-legend-keystone">Keystone</span>
          {!mobileMode && (
            <span className="tree-legend-item tree-legend-hint">Scroll to zoom · drag to pan</span>
          )}
        </div>
        </div>
  );
}
