import { SKILL_OFFER_POOL, PURE_SKILL_CTORS, MIGRATED_SKILL_TEMPLATES } from '../src/game/content/skills/index.js';
import {
  validateSkillOffers,
  validateMigratedSkillTemplates,
  validateEnemies,
  validateEnemyProfiles,
  validateMapProfiles,
  validateItems,
  validateAffixesPlaceholder,
} from '../src/game/content/schemas/index.js';
import {
  validateSkillRegistry,
  validateEnemyRegistry,
  validateMapRegistry,
  listFreeMaps,
  getEnemyMap,
  listItemDefs,
  listUniqueItemDefs,
  listGenericItemDefs,
} from '../src/game/content/registries/index.js';

function printBucket(title, messages, kind = 'INFO') {
  if (!messages.length) return;
  console.log(`\n[${kind}] ${title}`);
  for (const m of messages) console.log(`- ${m}`);
}

function collect() {
  const sections = [];

  sections.push({
    name: 'Skills',
    ...validateSkillOffers(SKILL_OFFER_POOL, PURE_SKILL_CTORS),
  });

  sections.push({
    name: 'Migrated Skill Templates',
    ...validateMigratedSkillTemplates(MIGRATED_SKILL_TEMPLATES, SKILL_OFFER_POOL, PURE_SKILL_CTORS),
  });

  sections.push({
    name: 'Skill Registry',
    ...validateSkillRegistry(),
  });

  sections.push({
    name: 'Enemies',
    ...validateEnemies(getEnemyMap()),
  });

  sections.push({
    name: 'Enemy Profiles',
    ...validateEnemyProfiles(),
  });

  sections.push({
    name: 'Enemy Registry',
    ...validateEnemyRegistry(listFreeMaps()),
  });

  sections.push({
    name: 'Map Profiles',
    ...validateMapProfiles(),
  });

  sections.push({
    name: 'Map Registry',
    ...validateMapRegistry(),
  });

  sections.push({
    name: 'Items',
    ...validateItems(listItemDefs(), listUniqueItemDefs(), listGenericItemDefs()),
  });
  sections.push({ name: 'Affixes', ...validateAffixesPlaceholder() });

  return sections;
}

function main() {
  const sections = collect();
  const errors = sections.flatMap((s) => s.errors.map((e) => `${s.name}: ${e}`));
  const warnings = sections.flatMap((s) => s.warnings.map((w) => `${s.name}: ${w}`));

  printBucket('Validation warnings', warnings, 'WARN');

  if (errors.length) {
    printBucket('Validation errors', errors, 'ERROR');
    console.error(`\nContent validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log('Content validation passed (Phase 9D scope: maps + enemies + skills + items cutover with registry-backed validation).');
}

main();
