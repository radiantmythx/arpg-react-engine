import fs from 'fs';

const R = (n, s) => `r${n}s${String(s).padStart(2, '0')}`;
const fmt = v => Number(v.toFixed(2));

const rings = [
  { n: 11, wHP: 60, rSpd: 0.13, sMana: 55, bHP: 38, bMana: 32, bNHP: 52, bNMana: 44, wName: 'Sear',      rName: 'Wail',      sName: 'Zap',       highway: false, prev: 10, next: 12 },
  { n: 12, wHP: 65, rSpd: 0.14, sMana: 60, bHP: 42, bMana: 35, bNHP: 58, bNMana: 48, wName: 'Char',      rName: 'Rime',      sName: 'Crackle',   highway: false, prev: 11, next: 13 },
  { n: 13, wHP: 70, rSpd: 0.15, sMana: 65, bHP: 46, bMana: 38, bNHP: 64, bNMana: 52, wName: 'Brand',     rName: 'Squall',    sName: 'Static',    highway: false, prev: 12, next: 14 },
  { n: 14, wHP: 75, rSpd: 0.16, sMana: 70, bHP: 50, bMana: 41, bNHP: 70, bNMana: 56, wName: 'Magma',     rName: 'Hail',      sName: 'Tempest',   highway: false, prev: 13, next: 15 },
  { n: 15, wHP: 80, rSpd: 0.17, sMana: 75, bHP: 54, bMana: 44, bNHP: 76, bNMana: 60, wName: 'Sovereign', rName: 'Sovereign', sName: 'Sovereign', highway: true,  prev: 14, next: null },
];

function makeNode(id, label, type, section, ring, slot, stats, conn) {
  const statsStr = Object.entries(stats).map(([k, v]) => `${k}: ${v}`).join(', ');
  const connStr  = conn.map(c => `'${c}'`).join(', ');
  return `  { id: '${id}', label: '${label}', type: '${type}', section: '${section}', ring: ${ring}, slot: ${slot}, stats: { ${statsStr} }, connections: [${connStr}], description: '[Placeholder r${ring}]' },`;
}

function genBroken(cfg) {
  const { n, wHP, rSpd, sMana, bHP, bMana, bNHP, bNMana, wName, rName, sName, prev, next } = cfg;
  const P = prev, N = next;
  const lines = [];
  const add = (s, label, type, section, stats, conn) =>
    lines.push(makeNode(R(n, s), label, type, section, n, s, stats, conn));

  // ── Branch 1: s00–s05 (warrior) ────────────────────────────────────────
  add(0,  `${wName} I`,    'minor', 'warrior', { maxHealth: wHP }, [R(P,0), R(n,1), R(N,0)]);
  add(1,  `${wName} II`,   'minor', 'warrior', { maxHealth: wHP }, [R(n,0), R(n,2)]);
  add(2,  `${wName} III`,  'minor', 'warrior', { maxHealth: wHP }, [R(n,1), R(n,3)]);
  add(3,  `${wName} IV`,   'minor', 'warrior', { maxHealth: wHP }, [R(n,2), R(n,4)]);
  add(4,  `${wName} V`,    'minor', 'warrior', { maxHealth: wHP }, [R(n,3), R(n,5)]);
  add(5,  `${wName} VI`,   'minor', 'warrior', { maxHealth: wHP }, [R(n,4)]);            // dead end

  // ── Branch 2: s06–s11 (warrior s06–s07 + W→R bridge s08–s11) ─────────
  add(6,  `${wName} VII`,       'minor',   'warrior', { maxHealth: wHP },              [R(P,6), R(n,7), R(N,6)]);
  add(7,  `${wName} VIII`,      'minor',   'warrior', { maxHealth: wHP },              [R(n,6), R(n,8)]);
  add(8,  `r${n} Bridge I`,     'minor',   'shared',  { maxHealth: bHP, maxMana: bMana },   [R(n,7), R(n,9)]);
  add(9,  `r${n} Bridge II`,    'minor',   'shared',  { maxHealth: bHP, maxMana: bMana },   [R(n,8), R(n,10)]);
  add(10, `r${n} Bridge Core`,  'notable', 'shared',  { maxHealth: bNHP, maxMana: bNMana }, [R(n,9), R(n,11)]);
  add(11, `r${n} Bridge III`,   'minor',   'shared',  { maxHealth: bHP, maxMana: bMana },   [R(n,10)]);       // dead end

  // ── Branch 3: s12–s17 (rogue) ──────────────────────────────────────────
  add(12, `${rName} I`,    'minor', 'rogue', { moveSpeedMult: rSpd }, [R(P,12), R(n,13), R(N,12)]);
  add(13, `${rName} II`,   'minor', 'rogue', { moveSpeedMult: rSpd }, [R(n,12), R(n,14)]);
  add(14, `${rName} III`,  'minor', 'rogue', { moveSpeedMult: rSpd }, [R(n,13), R(n,15)]);
  add(15, `${rName} IV`,   'minor', 'rogue', { moveSpeedMult: rSpd }, [R(n,14), R(n,16)]);
  add(16, `${rName} V`,    'minor', 'rogue', { moveSpeedMult: rSpd }, [R(n,15), R(n,17)]);
  add(17, `${rName} VI`,   'minor', 'rogue', { moveSpeedMult: rSpd }, [R(n,16)]);         // dead end

  // ── Branch 4: s18–s23 (rogue s18–s19 + R→S bridge s20–s23) ──────────
  add(18, `${rName} VII`,       'minor',   'rogue',  { moveSpeedMult: rSpd },                            [R(P,18), R(n,19), R(N,18)]);
  add(19, `${rName} VIII`,      'minor',   'rogue',  { moveSpeedMult: rSpd },                            [R(n,18), R(n,20)]);
  add(20, `r${n} Cross I`,      'minor',   'shared', { moveSpeedMult: fmt(rSpd*0.7), maxMana: bMana },   [R(n,19), R(n,21)]);
  add(21, `r${n} Cross II`,     'minor',   'shared', { moveSpeedMult: fmt(rSpd*0.7), maxMana: bMana },   [R(n,20), R(n,22)]);
  add(22, `r${n} Cross Core`,   'notable', 'shared', { moveSpeedMult: fmt(rSpd*0.9), maxMana: bNMana },  [R(n,21), R(n,23)]);
  add(23, `r${n} Cross III`,    'minor',   'shared', { moveSpeedMult: fmt(rSpd*0.7), maxMana: bMana },   [R(n,22)]);          // dead end

  // ── Branch 5: s24–s29 (sage) ───────────────────────────────────────────
  add(24, `${sName} I`,    'minor', 'sage', { maxMana: sMana }, [R(P,24), R(n,25), R(N,24)]);
  add(25, `${sName} II`,   'minor', 'sage', { maxMana: sMana }, [R(n,24), R(n,26)]);
  add(26, `${sName} III`,  'minor', 'sage', { maxMana: sMana }, [R(n,25), R(n,27)]);
  add(27, `${sName} IV`,   'minor', 'sage', { maxMana: sMana }, [R(n,26), R(n,28)]);
  add(28, `${sName} V`,    'minor', 'sage', { maxMana: sMana }, [R(n,27), R(n,29)]);
  add(29, `${sName} VI`,   'minor', 'sage', { maxMana: sMana }, [R(n,28)]);               // dead end

  // ── Branch 6: s30–s35 (sage s30–s31 + S→W bridge s32–s35) ───────────
  add(30, `${sName} VII`,      'minor',   'sage',   { maxMana: sMana },                          [R(P,30), R(n,31), R(N,30)]);
  add(31, `${sName} VIII`,     'minor',   'sage',   { maxMana: sMana },                          [R(n,30), R(n,32)]);
  add(32, `r${n} Forge I`,     'minor',   'shared', { maxMana: bMana,  maxHealth: bHP  },        [R(n,31), R(n,33)]);
  add(33, `r${n} Forge II`,    'minor',   'shared', { maxMana: bMana,  maxHealth: bHP  },        [R(n,32), R(n,34)]);
  add(34, `r${n} Forge Core`,  'notable', 'shared', { maxMana: bNMana, maxHealth: bNHP },        [R(n,33), R(n,35)]);
  add(35, `r${n} Forge III`,   'minor',   'shared', { maxMana: bMana,  maxHealth: bHP  },        [R(n,34)]);          // dead end

  return lines;
}

function genHighway(cfg) {
  const { n, wHP, rSpd, sMana, bHP, bMana, bNHP, bNMana, wName, rName, sName, prev } = cfg;
  const P = prev;
  const lines = [];

  const isSpoke = s => [0,6,12,18,24,30].includes(s);
  function sec(s) {
    if ([8,9,10,11,20,21,22,23,32,33,34,35].includes(s)) return 'shared';
    if (s >= 12 && s <= 19) return 'rogue';
    if (s >= 24 && s <= 31) return 'sage';
    return 'warrior';
  }
  function nodeStats(s) {
    const section = sec(s);
    if (section === 'warrior') return { maxHealth: wHP };
    if (section === 'rogue')   return { moveSpeedMult: rSpd };
    if (section === 'sage')    return { maxMana: sMana };
    if ([8,9,11].includes(s))  return { maxHealth: bHP, maxMana: bMana };
    if (s === 10)              return { maxHealth: bNHP, maxMana: bNMana };
    if ([20,21,23].includes(s)) return { moveSpeedMult: fmt(rSpd*0.7), maxMana: bMana };
    if (s === 22)              return { moveSpeedMult: fmt(rSpd*0.9), maxMana: bNMana };
    if ([32,33,35].includes(s)) return { maxMana: bMana, maxHealth: bHP };
    if (s === 34)              return { maxMana: bNMana, maxHealth: bNHP };
    return { maxHealth: wHP };
  }
  function nodeType(s) { return [10,22,34].includes(s) ? 'notable' : 'minor'; }
  const ordinals = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  function nodeLabel(s) {
    const section = sec(s);
    if (section === 'warrior') return `${wName} ${ordinals[s]}`;
    if (section === 'rogue')   return `${rName} ${ordinals[s-12]}`;
    if (section === 'sage')    return `${sName} ${ordinals[s-24]}`;
    if ([8,9,10,11].includes(s))   return `Eternal Bridge ${ordinals[s-8]}`;
    if ([20,21,22,23].includes(s)) return `Eternal Cross ${ordinals[s-20]}`;
    if ([32,33,34,35].includes(s)) return `Eternal Forge ${ordinals[s-32]}`;
    return `Eternal ${s}`;
  }

  for (let s = 0; s < 36; s++) {
    const prev_arc = s === 0 ? 35 : s - 1;
    const next_arc = s === 35 ? 0 : s + 1;
    const conn = [];
    if (isSpoke(s)) conn.push(R(P, s));
    conn.push(R(n, prev_arc));
    conn.push(R(n, next_arc));
    const desc = `[Placeholder r${n} — terminal highway]`;
    lines.push(makeNode(R(n,s), nodeLabel(s), nodeType(s), sec(s), n, s, nodeStats(s), conn));
  }
  return lines;
}

// ── Build the text block ──────────────────────────────────────────────────
const allLines = [
  '',
  '  // ══════════════════════════════════════════════════════════════════════════',
  '  //  RINGS 11–15 — Deep Extension (E2P7.75)',
  '  //',
  '  //  Highway rings:  r3, r7, r10, r15 — fully arc-connected, free rotation.',
  '  //  Broken rings:   r11, r12, r13, r14 — arcs severed at spoke boundaries.',
  '  //                  Each broken ring has 6 isolated dead-end branches (6 nodes each).',
  '  //  Spoke positions (every 60°): s00, s06, s12, s18, s24, s30',
  '  //  Broken ring spoke node: inward spoke + 1 arc (clockwise into branch) + outward spoke.',
  '  //  Branch terminal node (s05/s11/s17/s23/s29/s35): 1 connection — dead end.',
  '  //  Placeholder stats:  r11 W+60HP R+0.13spd S+55mana',
  '  //                      r12 W+65HP R+0.14spd S+60mana',
  '  //                      r13 W+70HP R+0.15spd S+65mana',
  '  //                      r14 W+75HP R+0.16spd S+70mana',
  '  //                      r15 W+80HP R+0.17spd S+75mana  (terminal highway)',
  '  // ══════════════════════════════════════════════════════════════════════════',
];

for (const cfg of rings) {
  allLines.push('');
  allLines.push(`  // ── RING ${cfg.n}${cfg.highway ? ' — Terminal Highway' : ' — Broken Ring'} ` + '─'.repeat(Math.max(1, 52 - cfg.n.toString().length)));
  const generated = cfg.highway ? genHighway(cfg) : genBroken(cfg);
  allLines.push(...generated);
}

// ── Splice into passiveTree.js ────────────────────────────────────────────
// The NODES array closes with `];` on its own line, followed by the export.
// We insert the new nodes just before that closing line.
let src = fs.readFileSync('src/game/data/passiveTree.js', 'utf8');
// Find the NODES closing bracket (the `];` line that precedes the export)
const marker = '];\n\n/**\n * Flat lookup map';
const splitIdx = src.indexOf(marker);
if (splitIdx === -1) { process.stderr.write('ERROR: could not find NODES closing marker\n'); process.exit(1); }
src = src.slice(0, splitIdx) + allLines.join('\n') + '\n' + src.slice(splitIdx);
fs.writeFileSync('src/game/data/passiveTree.js', src);

const count = allLines.filter(l => l.trim().startsWith('{')).length;
console.log(`Done — ${count} nodes appended for rings 11-15.`);
