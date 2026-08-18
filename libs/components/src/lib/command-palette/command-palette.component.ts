import { Component, ViewEncapsulation, afterNextRender, inject, viewChild } from '@angular/core';
import { AutoSurfaceDirective, COLOR_PROVIDER, ProvideColorDirective, createComponentId } from '@ethlete/core';
import { CommandPaletteItemComponent } from './command-palette-item.component';
import { injectCommandPaletteLabels } from './command-palette-labels';
import { CommandPaletteDirective, CommandPaletteSearchDirective } from './headless';

/**
 * The command palette: a search field over every registered command, ranked as the reader types.
 *
 * Open it as an overlay rather than placing it in a page - {@link commandPaletteOverlay} defines it as a
 * dialog, and {@link injectCommandPalette} opens that. Commands come from
 * {@link registerCommands}, not from this element's content.
 *
 * @example
 * <et-command-palette />
 */
@Component({
  selector: 'et-command-palette',
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [CommandPaletteItemComponent, CommandPaletteSearchDirective],
  hostDirectives: [
    { directive: CommandPaletteDirective, inputs: ['closeOnRun', 'query'], outputs: ['queryChange'] },
    ProvideColorDirective,
    AutoSurfaceDirective,
  ],
  host: {
    class: 'et-command-palette',
  },
})
export class CommandPaletteComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private contextColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });

  protected palette = inject(CommandPaletteDirective);
  protected labels = injectCommandPaletteLabels();

  private search = viewChild(CommandPaletteSearchDirective);
  private groupIdPrefix = createComponentId('et-command-palette-group');

  constructor() {
    // This panel IS the overlay's own surface, so it paints the registered elevation rather than stacking
    // a level above it - same reasoning as the menu's panel.
    inject(AutoSurfaceDirective).matchOverlaySurface();

    // The palette renders in a detached overlay pane, so colour context from wherever it was opened has
    // to be re-applied here instead of cascading through the DOM. In the constructor, so the theme is in
    // place before the enter animation's first painted frame.
    if (this.contextColorProvider) {
      this.ownColorProvider.syncWithProvider(this.contextColorProvider);
    }

    afterNextRender(() => this.search()?.focus());
  }

  protected groupId(label: string) {
    return `${this.groupIdPrefix}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }
}
