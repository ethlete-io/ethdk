import { Component, ElementRef, ViewEncapsulation, afterNextRender, inject, viewChild } from '@angular/core';
import {
  AutoSurfaceDirective,
  COLOR_PROVIDER,
  ProvideColorDirective,
  createComponentId,
  injectAnimatedBlockSize,
  injectAnimatedListItems,
} from '@ethlete/core';
import { springEasing } from '../overlay/strategies/spring-easing';
import { CommandPaletteItemComponent } from './command-palette-item.component';
import { injectCommandPaletteLabels } from './command-palette-labels';
import { CommandPaletteDirective, CommandPaletteSearchDirective } from './headless';

const RESIZE_SPRING = /* @__PURE__ */ springEasing({ response: 0.3, dampingFraction: 1 });
const MOVE_SPRING = /* @__PURE__ */ springEasing({ response: 0.3, dampingFraction: 0.86 });

/**
 * The command palette: a search field over every registered command, ranked as the reader types.
 *
 * Open it as an overlay rather than placing it in a page - {@link COMMAND_PALETTE_OVERLAY} defines it as a
 * dialog, and {@link createCommandPaletteOpener} opens that. Commands come from
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
  private searchField = viewChild.required<ElementRef<HTMLElement>>('searchField');
  private listContent = viewChild<ElementRef<HTMLElement>>('listContent');
  private empty = viewChild<ElementRef<HTMLElement>>('empty');
  private groupIdPrefix = createComponentId('et-command-palette-group');

  constructor() {
    inject(AutoSurfaceDirective).matchOverlaySurface();

    // In the constructor, so the theme is in place before the enter animation's first painted frame.
    if (this.contextColorProvider) {
      this.ownColorProvider.syncWithProvider(this.contextColorProvider);
    }

    injectAnimatedBlockSize({
      observe: [this.searchField, this.listContent, this.empty],
      duration: RESIZE_SPRING.durationMs,
      easing: RESIZE_SPRING.easing,
      resizingClass: 'et-command-palette--resizing',
    });

    injectAnimatedListItems({
      host: this.listContent,
      items: '.et-command-palette-item, .et-command-palette-group-label',
      moveDuration: MOVE_SPRING.durationMs,
      moveEasing: MOVE_SPRING.easing,
    });

    afterNextRender(() => this.search()?.focus());
  }

  protected groupId(index: number) {
    return `${this.groupIdPrefix}-${index}`;
  }
}
