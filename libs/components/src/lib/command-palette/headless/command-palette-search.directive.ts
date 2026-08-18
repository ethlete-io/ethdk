import { Directive, ElementRef, afterNextRender, effect, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { COMMAND_PALETTE_ERROR_CODES } from '../command-palette-errors';
import { CommandPaletteDirective } from './command-palette.directive';

/**
 * The palette's search field. Writes what the reader types into the palette's `query`, and hands the
 * keys that move between rows to the palette while keeping normal text editing for the rest.
 *
 * @example
 * <input etCommandPaletteSearch />
 */
@Directive({
  selector: 'input[etCommandPaletteSearch]',
  exportAs: 'etCommandPaletteSearch',
  host: {
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'true',
    '[attr.aria-controls]': 'listboxId()',
    '[attr.aria-activedescendant]': 'activeDescendantId()',
    '(input)': 'handleInput()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class CommandPaletteSearchDirective {
  private palette = inject(CommandPaletteDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);

  constructor() {
    effect(() => {
      const query = this.palette?.query() ?? '';
      const element = this.elementRef.nativeElement;

      if (element.value !== query) {
        element.value = query;
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.palette) {
          throw new RuntimeError(
            COMMAND_PALETTE_ERROR_CODES.SEARCH_OUTSIDE_PALETTE,
            '[CommandPaletteSearchDirective] etCommandPaletteSearch must be rendered inside an [etCommandPalette] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  public focus(options?: { select?: boolean }) {
    const element = this.elementRef.nativeElement;

    element.focus({ preventScroll: true });

    if (options?.select) {
      element.select();
    }
  }

  protected activeDescendantId() {
    return this.palette?.activeDescendantId() ?? null;
  }

  protected listboxId() {
    return this.palette?.listboxId ?? null;
  }

  protected handleInput() {
    this.palette?.query.set(this.elementRef.nativeElement.value);
  }

  protected handleKeydown(event: KeyboardEvent) {
    // Escape clears a query before it closes the palette, so one key both undoes a search and leaves.
    if (event.key === 'Escape' && this.elementRef.nativeElement.value) {
      event.preventDefault();
      event.stopPropagation();
      this.palette?.query.set('');
      this.elementRef.nativeElement.value = '';
    }
  }
}
