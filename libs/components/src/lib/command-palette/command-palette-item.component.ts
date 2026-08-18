import { Component, ElementRef, ViewEncapsulation, afterRenderEffect, computed, inject, input } from '@angular/core';
import { IconDirective } from '../icon';
import { KbdComponent } from '../kbd';
import { CommandPaletteResult } from './command-palette.types';
import { CommandPaletteDirective } from './headless';

/**
 * One row of the command palette. Rendered by `et-command-palette` from the ranked results; there is no
 * reason to place it yourself.
 */
@Component({
  selector: 'et-command-palette-item',
  templateUrl: './command-palette-item.component.html',
  styleUrl: './command-palette-item.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective, KbdComponent],
  host: {
    class: 'et-command-palette-item',
    role: 'option',
    '[id]': 'palette.rowId(command())',
    '[attr.aria-selected]': 'isActive()',
    '[attr.aria-disabled]': "command().disabled ? 'true' : null",
    '[class.et-command-palette-item--active]': 'isActive()',
    '(click)': 'palette.run(command())',
    // Keeps the caret in the search field, which is where every key the palette answers to is typed.
    '(mousedown)': '$event.preventDefault()',
    '(mouseenter)': 'palette.setActive(result())',
  },
})
export class CommandPaletteItemComponent {
  protected palette = inject(CommandPaletteDirective);
  private hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  public result = input.required<CommandPaletteResult>();

  protected command = computed(() => this.result().command);
  protected isActive = computed(() => this.command().id === this.palette.activeCommandId());

  constructor() {
    // After render, so a row that the latest query moved is measured where it now sits.
    afterRenderEffect(() => {
      // Optional call: the test environment's DOM has no `scrollIntoView`, and a row that cannot scroll
      // itself is not worth failing a render over.
      if (this.isActive()) {
        this.hostElement.nativeElement.scrollIntoView?.({ block: 'nearest' });
      }
    });
  }
}
