export const COMMAND_PALETTE_EXAMPLES = {
  'command-palette/command-palette-default': () =>
    import('./command-palette-default.example').then((m) => m.CommandPaletteDefaultExampleComponent),
};
