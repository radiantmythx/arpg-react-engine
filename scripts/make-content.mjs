import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function titleFromId(id = '') {
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function sanitizeId(rawId) {
  return String(rawId ?? '').trim();
}

const domain = process.argv[2];
const args = parseArgs(process.argv.slice(3));

const DOMAIN_CONFIG = {
  skill: {
    outputDir: path.join(repoRoot, 'src', 'game', 'content', 'skills'),
    fileName: (id) => `${id}.draft.js`,
    required: ['id', 'name'],
    defaults: { style: 'projectile', icon: '?', tags: 'Spell' },
    async existingIds() {
      const [{ MIGRATED_SKILL_TEMPLATES }, { PURE_SKILL_CTORS }] = await Promise.all([
        import('../src/game/content/skills/skillTemplates.js'),
        import('../src/game/content/skills/pureSkillCtors.js'),
      ]);
      return new Set([
        ...MIGRATED_SKILL_TEMPLATES.map((entry) => entry.id),
        ...Object.keys(PURE_SKILL_CTORS),
      ]);
    },
    render(values) {
      const tags = String(values.tags)
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => `'${tag}'`)
        .join(', ');
      return `export const SKILL_DRAFT = {\n  id: '${values.id}',\n  style: '${values.style}',\n  runtimeCtorId: '${values.id}',\n  name: '${values.name}',\n  icon: '${values.icon}',\n  description: 'Replace with a concise player-facing description.',\n  tags: [${tags}],\n};\n`;
    },
  },
  enemy: {
    outputDir: path.join(repoRoot, 'src', 'game', 'content', 'enemies'),
    fileName: (id) => `${id}.draft.js`,
    required: ['id'],
    defaults: { aiProfileId: 'direct_chase', color: '#ffffff' },
    async existingIds() {
      const [{ ENEMY_ARCHETYPES }, { ENEMY_TYPES }] = await Promise.all([
        import('../src/game/content/enemies/enemyArchetypes.js'),
        import('../src/game/config.js'),
      ]);
      return new Set([
        ...ENEMY_ARCHETYPES.map((entry) => entry.id),
        ...Object.keys(ENEMY_TYPES),
      ]);
    },
    render(values) {
      return `export const ENEMY_DRAFT = {\n  id: '${values.id}',\n  aiProfileId: '${values.aiProfileId}',\n  radius: 12,\n  speed: 90,\n  health: 30,\n  damage: 10,\n  xpValue: 3,\n  color: '${values.color}',\n  resistances: {},\n};\n`;
    },
  },
  map: {
    outputDir: path.join(repoRoot, 'src', 'game', 'content', 'maps'),
    fileName: (id) => `${id}.draft.js`,
    required: ['id', 'name'],
    defaults: {
      tier: '1',
      layoutProfileId: 'layout_replace_me',
      encounterProfileId: 'encounter_replace_me',
      rewardProfileId: 'reward_replace_me',
    },
    async existingIds() {
      const [{ MIGRATED_MAP_DEFINITIONS }, { FREE_MAPS }] = await Promise.all([
        import('../src/game/content/maps/mapDefinitions.js'),
        import('../src/game/data/mapDefs.js'),
      ]);
      return new Set([
        ...MIGRATED_MAP_DEFINITIONS.map((entry) => entry.id),
        ...FREE_MAPS.map((entry) => entry.id),
      ]);
    },
    render(values) {
      return `export const MAP_DRAFT = {\n  id: '${values.id}',\n  name: '${values.name}',\n  tier: ${Number(values.tier)},\n  description: 'Replace with a short biome or encounter description.',\n  unlockReq: null,\n  layoutProfileId: '${values.layoutProfileId}',\n  encounterProfileId: '${values.encounterProfileId}',\n  rewardProfileId: '${values.rewardProfileId}',\n};\n`;
    },
  },
  item: {
    outputDir: path.join(repoRoot, 'src', 'game', 'content', 'items'),
    fileName: (id) => `${id}.draft.js`,
    required: ['id', 'name'],
    defaults: { slot: 'weapon', color: '#ffffff' },
    async existingIds() {
      const { ITEM_DEFS } = await import('../src/game/content/items/index.js');
      return new Set(ITEM_DEFS.map((entry) => entry.id));
    },
    render(values) {
      return `export const ITEM_DRAFT = {\n  id: '${values.id}',\n  name: '${values.name}',\n  description: 'Replace with a concise item description.',\n  slot: '${values.slot}',\n  color: '${values.color}',\n  basePrice: 10,\n  gridW: 1,\n  gridH: 1,\n  stats: {\n    damageMult: 1.0,\n  },\n};\n`;
    },
  },
};

async function main() {
  const config = DOMAIN_CONFIG[domain];
  if (!config) {
    throw new Error(`Unknown content domain '${domain}'. Expected one of: ${Object.keys(DOMAIN_CONFIG).join(', ')}`);
  }

  const values = { ...config.defaults, ...args };
  values.id = sanitizeId(values.id);
  if (!config.required.includes('name') && !values.name && values.id) {
    values.name = titleFromId(values.id);
  }

  for (const key of config.required) {
    const value = String(values[key] ?? '').trim();
    if (!value) {
      throw new Error(`Missing required argument --${key}`);
    }
  }

  if (!/^[a-z0-9_]+$/i.test(values.id)) {
    throw new Error(`Invalid id '${values.id}'. Use letters, numbers, and underscores only.`);
  }

  const existingIds = await config.existingIds();
  if (existingIds.has(values.id)) {
    throw new Error(`Duplicate id '${values.id}' already exists in live content.`);
  }

  const outFile = path.join(config.outputDir, config.fileName(values.id));
  try {
    await fs.access(outFile);
    throw new Error(`Draft file already exists: ${path.relative(repoRoot, outFile)}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  await fs.mkdir(config.outputDir, { recursive: true });
  await fs.writeFile(outFile, config.render(values), 'utf8');

  console.log(`Created ${path.relative(repoRoot, outFile)}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
