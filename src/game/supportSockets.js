/**
 * Central support-socket progression helpers.
 * Open slots scale by gem level and are clamped to 1..5.
 */

export const MAX_SUPPORT_SOCKETS = 5;

/** @param {number} level */
export function openSupportSlotsForLevel(level) {
  const lv = Math.max(1, Math.floor(level ?? 1));
  return Math.max(1, Math.min(MAX_SUPPORT_SOCKETS, 1 + Math.floor((lv - 1) / 3)));
}

/**
 * @param {number} slotIndex - zero-based socket index.
 * @returns {number} minimum level required to unlock that socket.
 */
export function unlockLevelForSocketIndex(slotIndex) {
  const idx = Math.max(0, Math.floor(slotIndex ?? 0));
  return 1 + idx * 3;
}

/**
 * Returns how many sockets are open for a concrete skill object.
 * @param {object|null} skill
 */
export function openSupportSlotsForSkill(skill) {
  if (!skill || !Array.isArray(skill.supportSlots)) return 0;
  const total = skill.supportSlots.length;
  return Math.max(0, Math.min(total, openSupportSlotsForLevel(skill.level ?? 1)));
}
