import { CommandPaletteShortcutDirective } from './command-palette-shortcut.directive';
import { CommandPaletteComponent } from './command-palette.component';
import { CommandPaletteSearchDirective, CommandPaletteDirective } from './headless';

export const COMMAND_PALETTE_IMPORTS = [
  CommandPaletteComponent,
  CommandPaletteDirective,
  CommandPaletteSearchDirective,
  CommandPaletteShortcutDirective,
] as const;
