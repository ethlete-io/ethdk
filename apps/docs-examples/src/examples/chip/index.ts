export const CHIP_EXAMPLES = {
  'chip/chip-default': () => import('./chip-default.example').then((m) => m.ChipDefaultExampleComponent),
  'chip/chip-filter-chips': () => import('./chip-filter-chips.example').then((m) => m.ChipFilterChipsExampleComponent),
};
