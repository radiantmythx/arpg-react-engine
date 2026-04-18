export const LAYOUT_PROFILES = [
  {
    id: 'layout_ruins_linear',
    theme: 'ruins',
    layoutFamily: 'bsp_fortress',
    pathStyle: 'linear',
    notes: 'Parity-safe linear ruins layout profile.',
  },
  {
    id: 'layout_wastes_open',
    theme: 'wastes',
    layoutFamily: 'gauntlet_lane',
    pathStyle: 'linear',
    terrainProfile: 'ash+cracked_ice+mud',
    notes: 'Gauntlet verification profile for obstacle categories and placement rules.',
  },
  {
    id: 'layout_strand_corridor',
    theme: 'wastes',
    layoutFamily: 'strand_corridor',
    pathStyle: 'linear',
    terrainProfile: 'ash+mud',
    notes: 'Long strand-style corridor with linked hubs and boss endpoint.',
  },
  {
    id: 'layout_archive_flooded',
    theme: 'archive',
    layoutFamily: 'meandering_cavern',
    pathStyle: 'curved',
    notes: 'Parity-safe flooded archive layout profile.',
  },
  {
    id: 'layout_cathedral_blighted',
    theme: 'cathedral',
    layoutFamily: 'bsp_fortress',
    pathStyle: 'branching',
    notes: 'Parity-safe blighted cathedral layout profile.',
  },
  {
    id: 'layout_abyss_throne',
    theme: 'abyss',
    layoutFamily: 'bsp_fortress',
    pathStyle: 'linear',
    notes: 'Parity-safe burning abyss throne layout profile.',
  },
  {
    id: 'layout_fields_open',
    theme: 'fields',
    layoutFamily: 'open_fields',
    pathStyle: 'open',
    terrainProfile: 'mud+ash',
    notes: 'Wide open intersecting fields profile with sparse blockers.',
  },
];

export const LAYOUT_PROFILE_BY_ID = Object.fromEntries(LAYOUT_PROFILES.map((p) => [p.id, p]));
