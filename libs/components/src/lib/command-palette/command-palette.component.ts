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
    inject(AutoSurfaceDirective).matchOverlaySurface();

    // In the constructor, so the theme is in place before the enter animation's first painted frame.
    if (this.contextColorProvider) {
      this.ownColorProvider.syncWithProvider(this.contextColorProvider);
    }

    afterNextRender(() => this.search()?.focus());
  }

  protected groupId(index: number) {
    return `${this.groupIdPrefix}-${index}`;
  }
}
