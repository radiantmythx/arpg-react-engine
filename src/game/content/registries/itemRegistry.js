import {
  ITEM_DEFS,
  ITEMS_BY_ID,
  UNIQUE_ITEM_DEFS,
  GENERIC_ITEM_DEFS,
} from '../items/index.js';

export function listItemDefs() {
  return ITEM_DEFS;
}

export function listUniqueItemDefs() {
  return UNIQUE_ITEM_DEFS;
}

export function listGenericItemDefs() {
  return GENERIC_ITEM_DEFS;
}

export function getItemById(id) {
  return ITEMS_BY_ID[id] ?? null;
}
