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
import { useState, useRef } from 'react';
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
  const containerRef = useRef(null);

  const handleSvgMouseMove = (e) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleNodeClick = (id) => {
    const node = TREE_NODE_MAP[id];
    if (!node) return;
    setSelectedNodeId(id);
    if (mobileMode) {
      setHovered(node);
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

  return (
    <div className={`tree-overlay${mobileMode ? ' tree-overlay--mobile' : ''}`} onContextMenu={(e) => e.preventDefault()}>

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
            <span className="tree-points-zero">{mobileMode ? 'No points available — level up to earn more.' : 'No points available — press [P] or level up'}</span>
          )}
        </div>
        <div className="tree-header-right">
          <button className="btn tree-close-btn" onClick={onClose}>{mobileMode ? 'Done' : '✕ Close [P]'}</button>
        </div>
      </div>

      {/* ── SVG Tree ─────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="tree-svg-container"
        onMouseMove={handleSvgMouseMove}
      >
        <svg
          viewBox="0 0 900 900"
          preserveAspectRatio="xMidYMid meet"
          className="tree-svg"
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
                {(isAlloc || isAvail) && (
                  <circle
                    cx={x} cy={y} r={r + 6}
                    fill="none"
                    stroke={isAlloc ? '#f1c40f' : '#4a7fb5'}
                    strokeWidth={1}
                    opacity={isAlloc ? 0.35 : 0.22}
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

      {mobileMode && detailNode && (
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
