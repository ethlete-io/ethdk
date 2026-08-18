import { createOverlayOpener, defineOverlay, dialogOverlayStrategy } from '../overlay';
import { CommandPaletteComponent } from './command-palette.component';

/**
 * The palette as a centered dialog. Sits high in the viewport rather than in its middle, because the
 * list grows downwards as the reader types and a middle-anchored panel would shift under them.
 */
export const COMMAND_PALETTE_OVERLAY = /* @__PURE__ */ defineOverlay<CommandPaletteComponent>({
  component: CommandPaletteComponent,
  strategies: /* @__PURE__ */ dialogOverlayStrategy({
    width: 'min(560px, calc(100% - 32px))',
    maxHeight: '60%',
  }),
  panelClass: 'et-command-palette-panel',
});

/**
 * Opens the command palette. Call it in an injection context, then `open()` from a handler - or add
 * `[etCommandPaletteShortcut]` to an element and let a key chord open it.
 *
 * @example
 * private palette = injectCommandPalette();
 *
 * protected openPalette() {
 *   this.palette.open();
 * }
 */
export const injectCommandPalette = () => createOverlayOpener(COMMAND_PALETTE_OVERLAY);
