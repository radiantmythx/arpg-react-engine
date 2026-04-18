import { buildExplicitCandidates } from '../src/game/data/itemGenerator.js';
import { applyCraftingAction } from '../src/game/data/itemCrafting.js';
import { ITEM_DEFS } from '../src/game/content/items/itemCatalog.js';
import { normalizeWeaponItem } from '../src/game/data/weaponTypes.js';
import { generateItem } from '../src/game/data/itemGenerator.js';

// Simulate what vendor does: normalizeWeaponItem maps slot:'weapon' → 'mainhand'
const baseDef = ITEM_DEFS.find(d => d.id === 'stormcaller_staff');
const vendorItem = normalizeWeaponItem({ ...baseDef, uid: 'test-1', rarity: 'normal', itemLevel: 5, explicitAffixes: [], implicitAffixes: [], affixes: [], baseStats: baseDef.stats });
console.log('=== Stormcaller Staff after normalization ===');
console.log('slot:', vendorItem.slot, '  weaponType:', vendorItem.weaponType);

const candidates = buildExplicitCandidates(vendorItem, vendorItem.itemLevel);
console.log('Candidates:', candidates.length, candidates.map(c => c.id));

console.log('\n=== Transmute on normal staff ===');
const tx = applyCraftingAction(vendorItem, 'transmute');
console.log('ok:', tx.ok, '  reason:', tx.reason, '  rarity:', tx.afterItem?.rarity, '  affixes:', tx.afterItem?.explicitAffixes?.map(a => a.id));

console.log('\n=== Augment: magic-only check ===');
const rareShield = { ...ITEM_DEFS.find(d => d.id === 'spirit_shield'), uid: 'test-2', rarity: 'rare', itemLevel: 10, explicitAffixes: [], implicitAffixes: [], affixes: [], baseStats: {} };
const aug = applyCraftingAction(rareShield, 'augment');
console.log('Augment on rare:', aug.ok, aug.reason); // should fail with augment_requires_magic

const magicShield = { ...rareShield, uid: 'test-3', rarity: 'magic' };
const aug2 = applyCraftingAction(magicShield, 'augment');
console.log('Augment on magic:', aug2.ok, aug2.reason);

console.log('\n=== Chaos Orb on rare shield ===');
const rareShieldWithAffixes = generateItem(ITEM_DEFS.find(d => d.id === 'spirit_shield') ?? rareShield, 'rare', { itemLevel: 10 });
const chaos = applyCraftingAction(rareShieldWithAffixes, 'chaos_reroll');
console.log('Chaos reroll ok:', chaos.ok, '  reason:', chaos.reason, '  affixes:', chaos.afterItem?.explicitAffixes?.map(a => a.id));
