import { listSkillOffers } from '../src/game/content/registries/skillRegistry.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function buildVendorSkillRows() {
  return listSkillOffers().map((offer) => ({
    id: `skill:${offer.id}`,
    offerId: offer.id,
    kind: 'skill_gem',
  }));
}

function main() {
  const offers = listSkillOffers();
  const vendorRows = buildVendorSkillRows();

  const offerIds = new Set(offers.map((offer) => offer.id));
  const vendorOfferIds = new Set(vendorRows.map((row) => row.offerId));

  for (const offerId of offerIds) {
    assert(vendorOfferIds.has(offerId), `Missing vendor listing for skill offer '${offerId}'`);
  }
  for (const vendorId of vendorOfferIds) {
    assert(offerIds.has(vendorId), `Vendor has unknown skill listing '${vendorId}'`);
  }

  const bowOffers = offers.filter((offer) => /bow|arrow|barrage|volley|shot/i.test(`${offer.name} ${offer.description}`));

  console.log(`Vendor skill gem coverage OK: ${vendorOfferIds.size}/${offerIds.size} offers listed.`);
  console.log(`Bow-themed skill offers detected: ${bowOffers.length}.`);
}

main();
