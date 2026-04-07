import { rollRarity } from '../src/game/data/itemGenerator.js';

const SAMPLE_SIZE = 6000;
const CASES = [
  { label: 'diff1', difficulty: 1, isChampion: false },
  { label: 'diff5', difficulty: 5, isChampion: false },
  { label: 'diff5_champion', difficulty: 5, isChampion: true },
];

function sampleCase(entry) {
  const counts = { normal: 0, magic: 0, rare: 0 };
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const rarity = rollRarity(entry.difficulty, entry.isChampion);
    if (!(rarity in counts)) {
      throw new Error(`Unexpected rarity '${rarity}'`);
    }
    counts[rarity] += 1;
  }

  return {
    ...entry,
    counts,
    normalRate: counts.normal / SAMPLE_SIZE,
    magicRate: counts.magic / SAMPLE_SIZE,
    rareRate: counts.rare / SAMPLE_SIZE,
  };
}

function run() {
  const rows = CASES.map(sampleCase);
  const diff1 = rows[0];
  const diff5 = rows[1];
  const diff5Champion = rows[2];

  if (diff5.rareRate <= diff1.rareRate) {
    throw new Error('Rare drop rate should increase with difficulty');
  }
  if (diff5.magicRate <= diff1.magicRate) {
    throw new Error('Magic drop rate should increase with difficulty');
  }
  if (diff5Champion.normalRate !== 0) {
    throw new Error('Champion drops should never roll normal rarity');
  }

  console.log('Drop simulation passed.');
  for (const row of rows) {
    console.log(`- ${row.label}: normal=${row.normalRate.toFixed(3)}, magic=${row.magicRate.toFixed(3)}, rare=${row.rareRate.toFixed(3)}`);
  }
}

run();
