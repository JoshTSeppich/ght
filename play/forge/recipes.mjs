// Forge recipes (owner: Claude, Character Forge): every unit of every faction, a few lines each. Making a new character is
// adding a line here (or typing one into play/forge-studio.html): pick a base, a size, what it wears and what it holds.
// Bases, accessories and colour slots: play/forge/archetypes.mjs.
export const RECIPES = Object.freeze([
  // Toasters (the forge's take on the Cute Geometry Spec: rounded boxes, wheels, toast, team block)
  { id: 'crumb', faction: 'toasters', base: 'toaster', w: 1.0, h: 0.86, d: 0.76, slots: 1 },
  { id: 'popper', faction: 'toasters', base: 'toaster', w: 1.25, h: 1.1, d: 0.84 },
  { id: 'zapper', faction: 'toasters', base: 'toaster', w: 1.38, h: 0.98, d: 0.95, slots: 0, wear: ['emitters'] },
  { id: 'four-slice', faction: 'toasters', base: 'toaster', w: 2.3, h: 1.38, d: 1.35, slots: 4 },

  // Ghosters: porcelain bells, five facets; the Wisp has a crest, the Shade a cowl, the Phantom a long tail
  { id: 'wisp', faction: 'ghosters', base: 'ghost', width: 1.05, height: 1.15, hover: 0.3, wear: ['crest'] },
  { id: 'shade', faction: 'ghosters', base: 'ghost', width: 1.5, height: 1.05, hover: 0.15, wear: ['cowl'] },
  { id: 'phantom', faction: 'ghosters', base: 'ghost', width: 1.1, height: 1.55, hover: 0.4, wear: ['tail'] },
  { id: 'lantern', faction: 'ghosters', base: 'lantern', height: 1.4 },

  // Hosters: real humans throwing a party; each carries the thing it fights with
  { id: 'host', faction: 'hosters', base: 'human', height: 1.92, wear: ['tophat'], hold: 'clipboard' },
  { id: 'corkshot', faction: 'hosters', base: 'human', height: 1.78, build: 'slim', hold: 'bottle', colors: { jacket: '#2F4C8A', hair: '#E9C24A' }, wear: ['sunglasses'] },
  { id: 'confetti-bomber', faction: 'hosters', base: 'human', height: 1.74, wear: ['partyhat', 'popperpack'], colors: { jacket: '#7A4FB0' } },
  { id: 'bouncer', faction: 'hosters', base: 'human', height: 2.04, build: 'broad', wear: ['sunglasses'], hold: 'ropepost', colors: { jacket: '#1E1F26', hair: '#1A1A1A' } },
  { id: 'dj', faction: 'hosters', base: 'human', height: 1.82, wear: ['headphones', 'speakerpack'], colors: { jacket: '#2C8C7A' } },
  { id: 'hype-captain', faction: 'hosters', base: 'human', height: 1.9, wear: ['cap'], hold: 'megaphone', colors: { jacket: '#E07A2F' } },
]);

export const recipeOf = (id) => RECIPES.find((r) => r.id === id) ?? null;
