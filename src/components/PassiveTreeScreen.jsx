/**
 * PassiveTreeScreen — full-screen SVG passive skill tree overlay.
 *
 * The tree renders in a 900×900 SVG viewBox scaled to fit the screen.
 *
 * Node visual states:
 *   allocated — gold/bright, shows allocation glow
 *   available — steel-blue, pulsing ring (adjacent to allocated + cost <= skillPoints)
 *   locked    — dark gray, not clickable
 *
 * Node shapes:
 *   minor    — circle r=10
 *   notable  — circle r=16
 *   keystone — rotated square (diamond) r≈22
 *
 * Props:
 *   allocatedIds  — array of allocated node ids (converted to Set internally)
 *   skillPoints   — number of unspent skill points
 *   onAllocate(id) — called when player clicks an available node
 *   onClose        — called when player closes the tree
 */
import { useEffect, useRef, useState } from 'react';
import { PASSIVE_TREE_NODES, TREE_NODE_MAP, TREE_EDGES } from '../game/data/passiveTree.js';

const NODE_RADIUS = { minor: 10, notable: 16, keystone: 22 };

// State → fill color per type
const FILL = {
  minor:    { allocated: '#f1c40f', available: '#4a7fb5', locked: '#1e1e2e' },
  notable:  { allocated: '#f39c12', available: '#2980b9', locked: '#16162a' },
  keystone: { allocated: '#e74c3c', available: '#c0392b', locked: '#14142a' },
};

const STROKE = {
  allocated: 'rgba(255,255,255,0.55)',
  available: 'rgba(107,156,212,0.6)',
  locked:    'transparent',
};

const MIN_MOBILE_ZOOM = 0.8;
const MAX_MOBILE_ZOOM = 5;
const DEFAULT_MOBILE_ZOOM = 3.5;

function clampMobileZoom(value) {
  return Math.max(MIN_MOBILE_ZOOM, Math.min(MAX_MOBILE_ZOOM, value));
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
  const r   = NODE_RADIUS[node.type];
  const fill   = FILL[node.type][state];
  const stroke = STROKE[state];
  const { x, y } = node.position;

  if (node.type === 'keystone') {
    const s = r * 1.35;
    return (
      <rect
        x={x - s / 2} y={y - s / 2}
        width={s}      height={s}
        rx={3}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        transform={`rotate(45, ${x}, ${y})`}
      />
    );
  }
  return (
    <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />
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

  useEffect(() => {
    if (!mobileMode) return;
    const fallbackId = TREE_NODE_MAP.start ? 'start' : (PASSIVE_TREE_NODES[0]?.id ?? null);
    if (!selectedNodeId && fallbackId) {
      setSelectedNodeId(fallbackId);
    }
  }, [mobileMode, selectedNodeId]);

  const centerOnNode = (node, nextZoom = zoom) => {
    const container = containerRef.current;
    if (!container || !node) return;
    const rect = container.getBoundingClientRect();
    const baseSize = Math.min(rect.width - 12, rect.height - 12, 820);
    const offsetY = mobileMode ? Math.round(rect.height * -0.08) : 0;
    const relativeX = ((node.position.x / 900) - 0.5) * baseSize;
    const relativeY = ((node.position.y / 900) - 0.5) * baseSize;
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
    if (mobileMode && Date.now() < suppressNodeTapUntilRef.current) return;
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
    if (s.healthRegenPerS !== undefined) {
      const v = s.healthRegenPerS;
      lines.push(v >= 0 ? `+${v} HP regenerated per second` : `${v} HP per second (drain)`);
    }
    if (s.pickupRadiusFlat !== undefined) {
      lines.push(`+${s.pickupRadiusFlat} pickup radius`);
    }
    if (s.xpMultiplier !== undefined) {
      const pct = Math.round((s.xpMultiplier - 1) * 100);
      lines.push(pct >= 0 ? `+${pct}% experience gained` : `${pct}% experience gained`);
    }
    if (s.projectileCountBonus !== undefined) {
      lines.push(`+${s.projectileCountBonus} projectile${s.projectileCountBonus > 1 ? 's' : ''}`);
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
      className={`tree-svg-container${mobileMode ? ' tree-svg-container--mobile' : ''}${isDragging ? ' tree-svg-container--dragging' : ''}`}
      onMouseMove={mobileMode ? undefined : handleSvgMouseMove}
      onPointerDown={mobileMode ? handlePanStart : undefined}
      onPointerMove={mobileMode ? handlePanMove : undefined}
      onPointerUp={mobileMode ? handlePanEnd : undefined}
      onPointerCancel={mobileMode ? handlePanEnd : undefined}
    >
      <div
        className="tree-svg-pan"
        style={mobileMode ? { transform: `translate3d(${pan.x}px, ${pan.y}px, 0)` } : undefined}
      >
        <svg
          viewBox="0 0 900 900"
          preserveAspectRatio="xMidYMid meet"
          className="tree-svg"
          style={mobileMode ? { transform: `scale(${zoom})`, transformOrigin: 'center center' } : undefined}
        >
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
          const sw = bothAllocated ? 3 : 1.5;
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
          const r         = NODE_RADIUS[node.type];
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
                  cx={x} cy={y} r={r + 6}
                  fill="none"
                  stroke={isSelected ? '#8bd3ff' : (isAlloc ? '#f1c40f' : '#4a7fb5')}
                  strokeWidth={isSelected ? 2 : 1}
                  opacity={isSelected ? 0.65 : (isAlloc ? 0.35 : 0.22)}
                />
              )}

              {/* Pulse ring (available only) */}
              {isAvail && (
                <circle
                  cx={x} cy={y} r={r + 4}
                  fill="none"
                  stroke="#6b9cd4"
                  strokeWidth={1.5}
                  className="tree-pulse"
                />
              )}

              {/* Node shape */}
              <NodeShape node={node} state={state} />

              {/* Labels — notable and keystone only */}
              {(node.type === 'notable' || node.type === 'keystone') && (
                <text
                  x={x}
                  y={y + r + 13}
                  textAnchor="middle"
                  fill={state === 'locked' ? '#484860' : '#d0d0e0'}
                  fontSize={node.type === 'keystone' ? 10 : 9}
                  fontWeight="700"
                  fontFamily="'Courier New', Courier, monospace"
                  pointerEvents="none"
                  letterSpacing="0.5"
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
              {mobileMode ? 'No points available - level up to earn more.' : 'No points available - press [P] or level up'}
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
            {mobileMode ? '✕' : '✕ Close [P]'}
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
        <span className="tree-legend-item tree-legend-keystone">Keystone</span>
      </div>
    </div>
  );
}
