/**
 * MetaTreeScreen — full-screen SVG meta-progression tree overlay.
 *
 * Nodes cost Chaos Shards (persistent currency) instead of in-run skill points.
 * All allocations persist to localStorage via MetaProgression.
 *
 * Props:
 *   allocatedNodes  — Set<string> of already-allocated node ids
 *   shards          — number of available Chaos Shards
 *   onAllocate(id)  — called when player clicks an available node
 *   onClose         — called to dismiss the screen
 */
import { useState } from 'react';
import { META_TREE_NODES, META_NODE_MAP, META_TREE_EDGES } from '../game/data/metaTree.js';

const NODE_RADIUS = { minor: 10, notable: 16, keystone: 22 };

const FILL = {
  minor:    { allocated: '#f0c040', available: '#4a7fb5', locked: '#1e1e2e' },
  notable:  { allocated: '#e8a020', available: '#2475a8', locked: '#16162a' },
  keystone: { allocated: '#e06010', available: '#1a6090', locked: '#14142a' },
};

const STROKE = {
  allocated: 'rgba(255,255,255,0.55)',
  available: 'rgba(107,156,212,0.6)',
  locked:    'rgba(80,80,100,0.4)',
};

function getNodeState(id, allocatedSet, shards) {
  if (allocatedSet.has(id)) return 'allocated';
  const node = META_NODE_MAP[id];
  if (!node) return 'locked';
  const isRoot = id === 'meta_start';
  const adjacent = isRoot || node.connections.some((cid) => allocatedSet.has(cid));
  if (adjacent && shards >= node.cost) return 'available';
  return 'locked';
}

function NodeShape({ node, state }) {
  const r      = NODE_RADIUS[node.type];
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
        strokeWidth={2}
        transform={`rotate(45, ${x}, ${y})`}
      />
    );
  }
  return <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={2} />;
}

export function MetaTreeScreen({ allocatedNodes, shards, onAllocate, onClose }) {
  const [hovered, setHovered] = useState(null);
  const [tooltip,  setTooltip] = useState({ x: 0, y: 0 });

  const handleNodeClick = (id) => {
    if (getNodeState(id, allocatedNodes, shards) === 'available') {
      onAllocate(id);
    }
  };

  const handleSvgMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const hNode = hovered ? META_NODE_MAP[hovered] : null;

  return (
    <div className="meta-tree-overlay">
      <div className="meta-tree-header">
        <h2 className="meta-tree-title">Meta Progression</h2>
        <div className="meta-shard-balance">
          <span className="shard-icon">◆</span>
          <span className="shard-count">{shards}</span>
          <span className="shard-label"> Chaos Shards</span>
        </div>
        <button className="meta-tree-close" onClick={onClose}>✕ Close</button>
      </div>

      <div className="meta-tree-container">
        <svg
          className="meta-tree-svg"
          viewBox="0 0 900 600"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Edges */}
          {META_TREE_EDGES.map(([a, b]) => {
            const na = META_NODE_MAP[a];
            const nb = META_NODE_MAP[b];
            if (!na || !nb) return null;
            const bothAlloc = allocatedNodes.has(a) && allocatedNodes.has(b);
            return (
              <line
                key={`${a}-${b}`}
                x1={na.position.x} y1={na.position.y}
                x2={nb.position.x} y2={nb.position.y}
                stroke={bothAlloc ? '#f0c040' : '#333355'}
                strokeWidth={bothAlloc ? 2.5 : 1.5}
                opacity={bothAlloc ? 0.9 : 0.5}
              />
            );
          })}

          {/* Nodes */}
          {META_TREE_NODES.map((node) => {
            const state = getNodeState(node.id, allocatedNodes, shards);
            const isHov = hovered === node.id;
            return (
              <g
                key={node.id}
                style={{ cursor: state === 'available' ? 'pointer' : 'default' }}
                onClick={() => handleNodeClick(node.id)}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* hover / allocated glow ring */}
                {(isHov || state === 'allocated') && (
                  <circle
                    cx={node.position.x}
                    cy={node.position.y}
                    r={NODE_RADIUS[node.type] + (isHov ? 7 : 5)}
                    fill="none"
                    stroke={state === 'allocated' ? 'rgba(240,192,64,0.4)' : 'rgba(107,156,212,0.35)'}
                    strokeWidth={2}
                  />
                )}
                <NodeShape node={node} state={state} />
                {/* short label under the node */}
                {node.type !== 'minor' && (
                  <text
                    x={node.position.x}
                    y={node.position.y + NODE_RADIUS[node.type] + 13}
                    textAnchor="middle"
                    fontSize="9"
                    fill={state === 'allocated' ? '#f0c040' : '#8888aa'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.name}
                  </text>
                )}
                {/* cost badge on available nodes */}
                {state === 'available' && (
                  <text
                    x={node.position.x}
                    y={node.position.y + 4}
                    textAnchor="middle"
                    fontSize={node.type === 'minor' ? '8' : '9'}
                    fill="#c0e0ff"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.cost}◆
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hNode && (
          <div
            className="meta-node-tooltip"
            style={{ left: tooltip.x + 16, top: tooltip.y + 16 }}
          >
            <div className="meta-tooltip-name">{hNode.name}</div>
            <div className="meta-tooltip-desc">{hNode.description}</div>
            <div className="meta-tooltip-cost">
              Cost: <span className="meta-tooltip-shards">{hNode.cost} ◆ Chaos Shards</span>
            </div>
            {allocatedNodes.has(hNode.id) && (
              <div className="meta-tooltip-allocated">✓ Allocated</div>
            )}
          </div>
        )}
      </div>

      <div className="meta-tree-legend">
        <span className="meta-legend-item">
          <span className="legend-dot legend-allocated" />Allocated
        </span>
        <span className="meta-legend-item">
          <span className="legend-dot legend-available" />Available
        </span>
        <span className="meta-legend-item">
          <span className="legend-dot legend-locked" />Locked
        </span>
        <span className="meta-legend-hint">Click an available node to permanently unlock it.</span>
      </div>
    </div>
  );
}
