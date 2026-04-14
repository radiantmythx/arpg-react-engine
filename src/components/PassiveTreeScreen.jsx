import React, { useRef, useEffect, useCallback, useState } from 'react';
import { TREE_NODE_MAP } from '../game/data/passiveTree.js';

// ─── Layout constants ────────────────────────────────────────────────────────
const RING_RADII   = [0, 130, 240, 350, 570, 790, 1010, 1230, 1450, 1670, 1890, 2110, 2330, 2550, 2770, 2990]; // px from centre per ring — step doubles at r4 (110→220px)
const RING_SLOTS   = [8, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36]; // r1+ all 36 slots: 10° per slot, classes at 0°/120°/240°
const R3A_RADIUS   = 295; // inner spur ring: midpoint between r2(240) and r3(350)
const R3B_RADIUS   = 423; // outer spur ring: r3(350) + 1/3 of r3->r4 step(73)
const R4A_RADIUS   = 497; // inner spur ring: r4(570) − ⅓step(73) — between r3 and r4
const R4B_RADIUS   = 643; // outer spur ring: r4(570) + ⅓step(73) — between r4 and r5
const R5A_RADIUS   = 717;  // inner spur ring: r5(790) - 1/3 of step(73) — between r4 and r5
const R5B_RADIUS   = 863;  // outer spur ring: r5(790) + 1/3 of step(73) — between r5 and r6
const R6A_RADIUS   = 937;  // inner spur ring: r6(1010) - 1/3 of step(73) — between r5 and r6
const R6B_RADIUS   = 1083; // outer spur ring: r6(1010) + 1/3 of step(73) — between r6 and r7
const R7A_RADIUS   = 1157; // inner spur ring: r7(1230) - 1/3 of step(73) — between r6 and r7
const R7B_RADIUS   = 1303; // outer spur ring: r7(1230) + 1/3 of step(73) — between r7 and r8
const R8A_RADIUS   = 1377; // r8(1450) - 73
const R8B_RADIUS   = 1523; // r8(1450) + 73
const R9A_RADIUS   = 1597; // r9(1670) - 73
const R9B_RADIUS   = 1743; // r9(1670) + 73
const R10A_RADIUS  = 1817; // r10(1890) - 73
const R10B_RADIUS  = 1963; // r10(1890) + 73
const R11A_RADIUS  = 2037; // r11(2110) - 73
const R11B_RADIUS  = 2183; // r11(2110) + 73
const R12A_RADIUS  = 2257; // r12(2330) - 73
const R12B_RADIUS  = 2403; // r12(2330) + 73
const R13A_RADIUS  = 2477; // r13(2550) - 73
const R13B_RADIUS  = 2623; // r13(2550) + 73
const R14A_RADIUS  = 2697; // r14(2770) - 73
const R14B_RADIUS  = 2843; // r14(2770) + 73
const R15A_RADIUS  = 2917; // r15(2990) - 73
const R15B_RADIUS  = 3063; // r15(2990) + 73

// ─── Visual constants ────────────────────────────────────────────────────────
const NODE_RADIUS = { minor: 11, notable: 18, keystone: 20, start: 15, hub: 15 };
const HIGHWAY_RINGS = new Set([3, 7, 10, 15]); // full arc rings — travel only, no notables/keystones
const SECTION_COLOR = {
  warrior: '#e8722a',
  rogue:   '#4ab8d8',
  sage:    '#f0d050',
  shared:  '#c8a84b',
};
const ALLOCATED_GLOW = {
  warrior: 'rgba(232,114,42,0.55)',
  rogue:   'rgba(74,184,216,0.55)',
  sage:    'rgba(240,208,80,0.55)',
  shared:  'rgba(200,168,75,0.55)',
};

// ─── Polar → cartesian ──────────────────────────────────────────────────────
function nodeXY(node, cx, cy) {
  const slots = RING_SLOTS[node.ring] ?? 32;
  const angle = (node.slot / slots) * Math.PI * 2 - Math.PI / 2; // 0° = top
  const r     = node.radiusOverride ?? RING_RADII[node.ring] ?? 0;
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

// ─── Stat delta → readable string ───────────────────────────────────────────
const STAT_LABELS = {
  maxHealth:            (v) => `+${v} Max Health`,
  maxMana:              (v) => `+${v} Max Mana`,
  maxEnergyShield:      (v) => `+${v} Max Energy Shield`,
  healthRegenPerS:      (v) => `+${v.toFixed(1)} HP/s`,
  manaRegenPerS:        (v) => `+${v.toFixed(1)} Mana/s`,
  totalArmor:           (v) => `+${v} Armor`,
  totalEvasion:         (v) => `+${v} Evasion`,
  moveSpeedMult:        (v) => `+${Math.round(v*100)}% Movement Speed`,
  castSpeed:            (v) => `+${Math.round(v*100)}% Cast Speed`,
  attackSpeed:          (v) => `+${Math.round(v*100)}% Attack Speed`,
  spellDamage:          (v) => `+${Math.round(v*100)}% Spell Damage`,
  attackDamage:         (v) => `+${Math.round(v*100)}% Attack Damage`,
  aoeDamage:            (v) => `+${Math.round(v*100)}% AoE Damage`,
  flatBlazeDamage:      (v) => `+${v} Flat Fire Damage`,
  flatThunderDamage:    (v) => `+${v} Flat Lightning Damage`,
  flatFrostDamage:      (v) => `+${v} Flat Cold Damage`,
  flatPhysicalDamage:   (v) => `+${v} Flat Physical Damage`,
  flatHolyDamage:       (v) => `+${v} Flat Holy Damage`,
  flatUnholyDamage:     (v) => `+${v} Flat Unholy Damage`,
  increasedBlazeDamage:    (v) => `+${Math.round(v*100)}% Increased Fire Damage`,
  increasedThunderDamage:  (v) => `+${Math.round(v*100)}% Increased Lightning Damage`,
  increasedFrostDamage:    (v) => `+${Math.round(v*100)}% Increased Cold Damage`,
  increasedHolyDamage:     (v) => `+${Math.round(v*100)}% Increased Holy Damage`,
  increasedUnholyDamage:   (v) => `+${Math.round(v*100)}% Increased Unholy Damage`,
  increasedPhysicalDamage: (v) => `+${Math.round(v*100)}% Increased Physical Damage`,
  blazeResistance:      (v) => `+${Math.round(v*100)}% Fire Resistance`,
  thunderResistance:    (v) => `+${Math.round(v*100)}% Lightning Resistance`,
  frostResistance:      (v) => `+${Math.round(v*100)}% Cold Resistance`,
  xpMultiplier:         (v) => `+${Math.round(v*100)}% Experience Gained`,
  pickupRadiusBonus:    (v) => `+${v} Pickup Radius`,
  projectileCountBonus: (v) => `+${v} Projectile(s)`,
};

function statLines(stats) {
  if (!stats) return [];
  return Object.entries(stats)
    .filter(([, v]) => v != null && v !== 0)
    .map(([k, v]) => STAT_LABELS[k]?.(v) ?? `+${v} ${k}`);
}

// ─── Icon picker ─────────────────────────────────────────────────────────────
// Returns an emoji representing the node's primary stat theme.
// Computed at render time — no per-node data changes required.
function iconForNode(node) {
  if (node.type === 'hub')      return '🌟';
  if (node.type === 'start')    return '⭐';
  if (node.type === 'keystone') return '💎';
  const s = node.stats ?? {};
  if (s.flatBlazeDamage    || s.increasedBlazeDamage)    return '🔥';
  if (s.flatFrostDamage    || s.increasedFrostDamage)    return '❄️';
  if (s.flatThunderDamage  || s.increasedThunderDamage)  return '⚡';
  if (s.flatPhysicalDamage || s.increasedPhysicalDamage) return '⚔️';
  if (s.flatHolyDamage || s.increasedHolyDamage)      return '✨';
  if (s.flatUnholyDamage || s.increasedUnholyDamage)  return '💀';
  if (s.moveSpeedMult)     return '💨';
  if (s.attackSpeed)       return '🗡️';
  if (s.castSpeed)         return '✨';
  if (s.totalEvasion && !s.totalArmor) return '🌀';
  if (s.totalArmor)        return '🛡️';
  if (s.manaRegenPerS && !s.maxMana)   return '💧';
  if (s.healthRegenPerS && !s.maxHealth) return '💚';
  if (s.maxMana && !s.maxHealth)       return '🔮';
  if (s.maxHealth)         return '❤️';
  if (node.type === 'notable') return '🔸';
  return '';
}

// ─── Draw helpers ────────────────────────────────────────────────────────────
function drawStar(ctx, x, y, r, points = 6) {
  const inner = r * 0.48;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const d = i % 2 === 0 ? r : inner;
    i === 0 ? ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d)
            : ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}

function drawNode(ctx, node, pos, allocated, allocatable) {
  const col   = SECTION_COLOR[node.section] ?? '#aaa';
  const glow  = ALLOCATED_GLOW[node.section] ?? 'rgba(200,200,200,0.4)';
  const nr    = NODE_RADIUS[node.type] ?? 10;
  const isKS  = node.type === 'keystone';
  const isNot = node.type === 'notable';

  // Glow behind allocated nodes
  if (allocated) {
    ctx.save();
    ctx.shadowColor  = glow;
    ctx.shadowBlur   = isKS ? 28 : isNot ? 20 : 14;
  }

  // Shape
  if (isKS) {
    drawStar(ctx, pos.x, pos.y, nr);
  } else {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, nr, 0, Math.PI * 2);
  }

  if (allocated) {
    ctx.fillStyle = col;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    if (isKS) drawStar(ctx, pos.x, pos.y, nr); else { ctx.beginPath(); ctx.arc(pos.x, pos.y, nr, 0, Math.PI * 2); }
    ctx.stroke();
  } else if (allocatable) {
    // Reachable, not yet taken — pulsing lighter ring handled via alpha in caller
    ctx.fillStyle = '#1e1e2a';
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth   = 2;
    if (isKS) drawStar(ctx, pos.x, pos.y, nr); else { ctx.beginPath(); ctx.arc(pos.x, pos.y, nr, 0, Math.PI * 2); }
    ctx.stroke();
  } else {
    ctx.fillStyle = '#111118';
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth   = 1.5;
    if (isKS) drawStar(ctx, pos.x, pos.y, nr); else { ctx.beginPath(); ctx.arc(pos.x, pos.y, nr, 0, Math.PI * 2); }
    ctx.stroke();
  }

  // Icon emoji — centered inside the node
  const icon = iconForNode(node);
  if (icon) {
    const fontSize = Math.max(10, Math.round(nr * 0.85));
    ctx.font         = `${fontSize}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha  = allocated ? 1.0 : allocatable ? 0.8 : 0.45;
    ctx.fillText(icon, pos.x, pos.y);
    ctx.globalAlpha  = 1;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export function PassiveTreeScreen({
  allocatedIds,
  skillPoints,
  onAllocate,
  onRefund,
  onRefundAll,
  onClose,
  mobileMode,
}) {
  const canvasRef  = useRef(null);
  const stateRef   = useRef({ pan: { x: 0, y: 0 }, zoom: 1, drag: null, pulse: 0, ringPulses: [] });
  const rafRef     = useRef(null);
  const [tooltip, setTooltip] = useState(null); // { node, sx, sy }

  // Normalise allocatedIds to a Set regardless of what App.jsx passes
  const allocSet = allocatedIds instanceof Set
    ? allocatedIds
    : new Set(allocatedIds ?? []);

  const nodes = Object.values(TREE_NODE_MAP);

  // ── Centre of the canvas in world space ───────────────────────────────────
  function worldCentre(canvas) {
    const s = stateRef.current;
    return {
      cx: (canvas.width  / 2 - s.pan.x) / s.zoom,
      cy: (canvas.height / 2 - s.pan.y) / s.zoom,
    };
  }

  // ── Hit-test: find node under canvas pixel (px, py) ──────────────────────
  function hitTest(canvas, px, py) {
    const s = stateRef.current;
    // Canvas pixel → world
    const wx = (px - canvas.width  / 2 - s.pan.x) / s.zoom;
    const wy = (py - canvas.height / 2 - s.pan.y) / s.zoom;
    const cx = 0, cy = 0; // world centre is (0,0)
    for (const node of nodes) {
      const pos = nodeXY(node, cx, cy);
      const nr  = (NODE_RADIUS[node.type] ?? 10) + 4; // generous hit margin
      if ((wx - pos.x) ** 2 + (wy - pos.y) ** 2 <= nr * nr) return node;
    }
    return null;
  }

  // ── Main draw ─────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const s   = stateRef.current;
    const W   = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Dark radial background
    const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W, H) * 0.72);
    bg.addColorStop(0, '#12121e');
    bg.addColorStop(1, '#070710');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Apply pan + zoom, centred
    ctx.save();
    ctx.translate(W / 2 + s.pan.x, H / 2 + s.pan.y);
    ctx.scale(s.zoom, s.zoom);

    const cx = 0, cy = 0;

    // Ghost rings
    ctx.save();
    ctx.setLineDash([4, 8]);
    for (let ring = 1; ring <= 15; ring++) {
      ctx.beginPath();
      ctx.arc(cx, cy, RING_RADII[ring], 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth   = 1 / s.zoom;
      ctx.stroke();
    }
    // r3a / r3b / r4a / r4b / r5a / r5b spur rings
    for (const sr of [R3A_RADIUS, R3B_RADIUS, R4A_RADIUS, R4B_RADIUS, R5A_RADIUS, R5B_RADIUS, R6A_RADIUS, R6B_RADIUS, R7A_RADIUS, R7B_RADIUS, R8A_RADIUS, R8B_RADIUS, R9A_RADIUS, R9B_RADIUS, R10A_RADIUS, R10B_RADIUS, R11A_RADIUS, R11B_RADIUS, R12A_RADIUS, R12B_RADIUS, R13A_RADIUS, R13B_RADIUS, R14A_RADIUS, R14B_RADIUS, R15A_RADIUS, R15B_RADIUS]) {
      ctx.beginPath();
      ctx.arc(cx, cy, sr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth   = 1 / s.zoom;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // Allocatable set: adjacent to allocated AND not already allocated
    const allocatable = new Set();
    for (const node of nodes) {
      if (allocSet.has(node.id)) continue;
      if (node.connections.some((cid) => allocSet.has(cid))) {
        allocatable.add(node.id);
      }
    }

    // ── Connections ──────────────────────────────────────────────────────────
    const drawn = new Set();
    for (const node of nodes) {
      const posA = nodeXY(node, cx, cy);
      for (const cid of node.connections) {
        const key = [node.id, cid].sort().join('|');
        if (drawn.has(key)) continue;
        drawn.add(key);
        const other = TREE_NODE_MAP[cid];
        if (!other) continue;
        const posB = nodeXY(other, cx, cy);

        const bothAlloc = allocSet.has(node.id) && allocSet.has(cid);
        const eitherAlloc = allocSet.has(node.id) || allocSet.has(cid);

        // Pick color from whichever end is allocated (or the section color)
        const sect = allocSet.has(node.id) ? node.section : other.section;
        const col  = bothAlloc ? SECTION_COLOR[sect]
                    : eitherAlloc ? SECTION_COLOR[sect]
                    : '#2a2a3a';

        ctx.beginPath();
        ctx.moveTo(posA.x, posA.y);
        ctx.lineTo(posB.x, posB.y);
        ctx.strokeStyle = col;
        ctx.lineWidth   = bothAlloc ? 2.5 : 1.5;
        ctx.globalAlpha = bothAlloc ? 0.9 : eitherAlloc ? 0.55 : 0.3;

        if (bothAlloc) {
          ctx.shadowColor = ALLOCATED_GLOW[sect];
          ctx.shadowBlur  = 8;
        }
        ctx.stroke();
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;
      }
    }

    // ── Nodes ─────────────────────────────────────────────────────────────────
    // Pulse alpha for allocatable nodes
    const pulse = 0.55 + 0.45 * Math.sin(s.pulse);
    for (const node of nodes) {
      const pos   = nodeXY(node, cx, cy);
      const alloc = allocSet.has(node.id);
      const reach = allocatable.has(node.id);

      if (reach && !alloc) ctx.globalAlpha = pulse;
      drawNode(ctx, node, pos, alloc, reach);
      ctx.globalAlpha = 1;
    }

    // ── Ring pulse animations (node allocation feedback) ──────────────────────
    for (const p of s.ringPulses) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.strokeStyle = p.col;
      ctx.lineWidth = 3 / s.zoom;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore(); // end pan+zoom

    // ── HUD overlay ───────────────────────────────────────────────────────────
    ctx.font      = 'bold 15px serif';
    ctx.fillStyle = '#e0c97f';
    ctx.fillText(`Passive Points: ${skillPoints ?? 0}`, 14, 28);
    ctx.font      = '12px serif';
    ctx.fillStyle = '#888';
    ctx.fillText('Left-click: allocate   Right-click: refund   Scroll: zoom   Drag: pan', 14, 48);

    rafRef.current = requestAnimationFrame(draw);
  }, [allocSet, nodes, skillPoints]);

  // ── Pulse + resize ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      canvas.width  = canvas.parentElement?.clientWidth  ?? window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight ?? window.innerHeight;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? document.body);

    let t = 0;
    function loop() {
      t += 0.045;
      stateRef.current.pulse = t;
      // Advance ring pulses
      const rp = stateRef.current.ringPulses;
      if (rp.length > 0) {
        for (const p of rp) { p.r += 1.8; p.alpha -= 0.028; }
        stateRef.current.ringPulses = rp.filter(p => p.alpha > 0);
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    loop();
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  // Redraw whenever props change (new allocation)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ── Mouse events ─────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    stateRef.current.drag = { startX: e.clientX, startY: e.clientY, panX: stateRef.current.pan.x, panY: stateRef.current.pan.y };
  }, []);

  const onMouseMove = useCallback((e) => {
    const s = stateRef.current;
    if (s.drag) {
      s.pan.x = s.drag.panX + (e.clientX - s.drag.startX);
      s.pan.y = s.drag.panY + (e.clientY - s.drag.startY);
    }
    // Tooltip
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const node = hitTest(canvas, e.clientX - rect.left, e.clientY - rect.top);
    setTooltip(node ? { node, sx: e.clientX, sy: e.clientY } : null);
  }, []);

  const onMouseUp = useCallback((e) => {
    const s = stateRef.current;
    const wasDrag = s.drag && (Math.abs(e.clientX - s.drag.startX) > 4 || Math.abs(e.clientY - s.drag.startY) > 4);
    s.drag = null;
    if (wasDrag) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const node = hitTest(canvas, e.clientX - rect.left, e.clientY - rect.top);
    if (!node) return;

    if (e.button === 2) {
      // Right-click: refund
      if (node.type !== 'start' && node.type !== 'hub') onRefund?.(node.id);
    } else {
      // Left-click: allocate + ring pulse feedback
      const pos = nodeXY(node, 0, 0);
      stateRef.current.ringPulses.push({ x: pos.x, y: pos.y, r: NODE_RADIUS[node.type] ?? 10, col: SECTION_COLOR[node.section] ?? '#aaa', alpha: 1.0 });
      onAllocate?.(node.id);
    }
  }, [onAllocate, onRefund]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const s = stateRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    s.zoom = Math.min(2.2, Math.max(0.35, s.zoom * factor));
  }, []);

  const onMouseLeave = useCallback(() => {
    stateRef.current.drag = null;
    setTooltip(null);
  }, []);

  // ── Tooltip render ────────────────────────────────────────────────────────
  function Tooltip({ data }) {
    if (!data) return null;
    const { node, sx, sy } = data;
    const col     = SECTION_COLOR[node.section] ?? '#aaa';
    const lines   = statLines(node.stats);
    const isAlloc = allocSet.has(node.id);
    const typeStr = node.type.charAt(0).toUpperCase() + node.type.slice(1);

    // Display name: minor nodes use a generic label instead of individual names.
    const displayLabel = node.type === 'minor'
      ? (HIGHWAY_RINGS.has(node.ring) ? 'Minor Traversal Passive' : 'Minor Passive')
      : node.label;

    // Economy: allocation costs passive points; refund costs gold (ring-scaled, inner rings free gold).
    const isHub      = node.type === 'hub' || node.type === 'start';
    const allocCost  = isHub ? 0 : node.ring <= 2 ? 5 : Math.max(1, node.ring - 2);
    const goldCost   = isHub ? 0 : node.ring <= 2 ? 0 : 25 * Math.max(1, node.ring - 2);
    const allocCostStr = allocCost === 0 ? 'Free' : `${allocCost} passive point${allocCost !== 1 ? 's' : ''}`;
    const goldCostStr  = goldCost  === 0 ? 'Free' : `${goldCost}g`;

    // Keep tooltip on screen
    const left = Math.min(sx + 14, window.innerWidth  - 230);
    const top  = Math.min(sy + 14, window.innerHeight - 180);

    return (
      <div style={{
        position: 'fixed', left, top, zIndex: 2000,
        background: '#0e0e18', border: `1px solid ${col}`,
        borderRadius: 6, padding: '10px 14px', minWidth: 190,
        pointerEvents: 'none', fontFamily: 'serif',
      }}>
        <div style={{ color: col, fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>
          {displayLabel}
        </div>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>
          {typeStr} · {node.section}
          {isAlloc ? <span style={{ color: '#5f5', marginLeft: 8 }}>✓ Allocated</span> : null}
        </div>
        {lines.map((l, i) => (
          <div key={i} style={{ color: '#c8c8c8', fontSize: 12, lineHeight: 1.5 }}>{l}</div>
        ))}
        {lines.length === 0 && (
          <div style={{ color: '#555', fontSize: 11, fontStyle: 'italic' }}>No stat bonuses</div>
        )}
        {node.description && (
          <div style={{ color: '#777', fontSize: 11, marginTop: 6, borderTop: '1px solid #222', paddingTop: 5, fontStyle: 'italic' }}>
            {node.description}
          </div>
        )}
        <div style={{ color: '#555', fontSize: 10, marginTop: 8, borderTop: '1px solid #1a1a2a', paddingTop: 5 }}>
          {isAlloc
            ? <>↺ Refund · <span style={{ color: goldCost > 0 ? '#e0a84a' : '#5c8' }}>{goldCostStr}</span></>
            : <>▶ Allocate · <span style={{ color: '#b0c8ff' }}>{allocCostStr}</span></>
          }
        </div>
      </div>
    );
  }

  // ── Mobile touch ────────────────────────────────────────────────────────────
  const mobileTapRef = useRef(null); // { node, time }
  const pinchRef     = useRef(null); // { dist }

  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy) };
      stateRef.current.drag = null;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      stateRef.current.drag = {
        startX: t.clientX, startY: t.clientY,
        panX: stateRef.current.pan.x, panY: stateRef.current.pan.y,
      };
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchRef.current) {
      const dx      = e.touches[0].clientX - e.touches[1].clientX;
      const dy      = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const factor  = newDist / Math.max(1, pinchRef.current.dist);
      const s       = stateRef.current;
      s.zoom = Math.min(2.2, Math.max(0.35, s.zoom * factor));
      pinchRef.current.dist = newDist;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const s = stateRef.current;
      if (s.drag) {
        s.pan.x = s.drag.panX + (t.clientX - s.drag.startX);
        s.pan.y = s.drag.panY + (t.clientY - s.drag.startY);
      }
    }
  }, []);

  const onTouchEnd = useCallback((e) => {
    pinchRef.current = null;
    const s  = stateRef.current;
    const ct = e.changedTouches[0];
    const wasDrag = s.drag && ct && (
      Math.abs(ct.clientX - s.drag.startX) > 6 ||
      Math.abs(ct.clientY - s.drag.startY) > 6
    );
    s.drag = null;
    if (wasDrag || !ct) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const node = hitTest(canvas, ct.clientX - rect.left, ct.clientY - rect.top);
    if (!node) { mobileTapRef.current = null; return; }

    const now  = Date.now();
    const prev = mobileTapRef.current;
    if (prev && prev.node.id === node.id && now - prev.time < 800) {
      mobileTapRef.current = null;
      if (allocSet.has(node.id)) {
        if (node.type !== 'start' && node.type !== 'hub') onRefund?.(node.id);
      } else {
        const pos = nodeXY(node, 0, 0);
        stateRef.current.ringPulses.push({ x: pos.x, y: pos.y, r: NODE_RADIUS[node.type] ?? 10, col: SECTION_COLOR[node.section] ?? '#aaa', alpha: 1.0 });
        onAllocate?.(node.id);
      }
    } else {
      mobileTapRef.current = { node, time: now };
      setTooltip({ node, sx: ct.clientX, sy: ct.clientY });
    }
  }, [allocSet, onAllocate, onRefund]);

  // ── Main return ─────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#07070f' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={onWheel}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 12, right: 16,
          background: 'rgba(255,255,255,0.08)', border: '1px solid #444',
          color: '#ccc', borderRadius: 6, padding: '4px 14px', cursor: 'pointer',
          fontFamily: 'serif', fontSize: 14,
        }}
      >
        ✕ Close
      </button>
      <button
        onClick={onRefundAll}
        style={{
          position: 'absolute', top: 12, right: 96,
          background: 'rgba(180,100,0,0.18)', border: '1px solid #a06020',
          color: '#e0a84a', borderRadius: 6, padding: '4px 14px', cursor: 'pointer',
          fontFamily: 'serif', fontSize: 14,
        }}
      >
        ⟳ Refund All
      </button>
      <Tooltip data={tooltip} />
    </div>
  );
}


