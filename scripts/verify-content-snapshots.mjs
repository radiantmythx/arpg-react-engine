import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSkillOfferIds, listEnemyIds, listFreeMaps } from '../src/game/content/registries/index.js';
import { listItemDefs } from '../src/game/content/registries/itemRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snapshotPath = path.join(__dirname, 'snapshots', 'content-ids.snapshot.json');

function compareArray(label, expected, actual, errors) {
  const expectedJson = JSON.stringify(expected);
  const actualJson = JSON.stringify(actual);
  if (expectedJson !== actualJson) {
    errors.push(`${label} mismatch`);
  }
}

async function run() {
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
  const actual = {
    skillOfferIds: listSkillOfferIds(),
    enemyRegistryIds: listEnemyIds(),
    freeMapIds: listFreeMaps().map((m) => m.id),
    itemBaseIds: listItemDefs().map((item) => item.id),
  };

  const errors = [];
  compareArray('skillOfferIds', snapshot.skillOfferIds, actual.skillOfferIds, errors);
  compareArray('enemyRegistryIds', snapshot.enemyRegistryIds, actual.enemyRegistryIds, errors);
  compareArray('freeMapIds', snapshot.freeMapIds, actual.freeMapIds, errors);
  compareArray('itemBaseIds', snapshot.itemBaseIds, actual.itemBaseIds, errors);

  if (errors.length) {
    console.error('Content snapshot verification failed.');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('Content snapshot verification passed.');
  console.log(`- skillOfferIds=${actual.skillOfferIds.length}`);
  console.log(`- enemyRegistryIds=${actual.enemyRegistryIds.length}`);
  console.log(`- freeMapIds=${actual.freeMapIds.length}`);
  console.log(`- itemBaseIds=${actual.itemBaseIds.length}`);
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
