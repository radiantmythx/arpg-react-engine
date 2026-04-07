export const LAYOUT_PROFILES = [
  {
    id: 'layout_ruins_linear',
    theme: 'ruins',
    notes: 'Parity-safe linear ruins layout profile.',
  },
  {
    id: 'layout_wastes_open',
    theme: 'wastes',
    notes: 'Parity-safe open wastes layout profile.',
  },
  {
    id: 'layout_archive_flooded',
    theme: 'archive',
    notes: 'Parity-safe flooded archive layout profile.',
  },
  {
    id: 'layout_cathedral_blighted',
    theme: 'cathedral',
    notes: 'Parity-safe blighted cathedral layout profile.',
  },
  {
    id: 'layout_abyss_throne',
    theme: 'abyss',
    notes: 'Parity-safe burning abyss throne layout profile.',
  },
];

export const LAYOUT_PROFILE_BY_ID = Object.fromEntries(LAYOUT_PROFILES.map((p) => [p.id, p]));
