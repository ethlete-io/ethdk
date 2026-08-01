import { DOCUMENT, Directive, ElementRef, afterNextRender, effect, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { registerSingleton } from '../../form-field/headless';
import { CASCADER_ERROR_CODES } from '../cascader-errors';
import { CascaderDirective } from './cascader.directive';

/**
 * Opts a cascader into flat search. While the (trimmed) query is non-empty the panel swaps its
 * columns for a flat result list fed by the data source's `search` hook - each result is a full
 * root → node path, so a known leaf can be jumped to without drilling. The input takes initial
 * focus on open; ArrowDown moves roving focus into the results (or the tree while browsing),
 * and the first Escape clears the query instead of closing the panel.
 */
@Directive({
  selector: 'input[etCascaderSearch]',
  exportAs: 'etCascaderSearch',
  host: {
    autocomplete: 'off',
    '(input)': 'handleInput()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class CascaderSearchDirective {
  private cascader = inject(CascaderDirective, { optional: true });
  private document = inject(DOCUMENT);
  public elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);

  constructor() {
    registerSingleton(this.cascader?.registeredSearch, this);

    // the query lives on the cascader (it outlives the panel-hosted input) - mirror it back
    // into the element for programmatic writes like clearSearch()
    effect(() => {
      const query = this.cascader?.searchQuery() ?? '';
      const element = this.elementRef.nativeElement;

      if (element.value !== query) {
        element.value = query;
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.cascader) {
          throw new RuntimeError(
            CASCADER_ERROR_CODES.SEARCH_OUTSIDE_CASCADER,
            '[CascaderSearchDirective] etCascaderSearch must be rendered inside the surface of an [etCascader] element.',
          );
        }
      });
    }
  }

  /** @internal */
  public isFocused() {
    return this.document.activeElement === this.elementRef.nativeElement;
  }

  /** @internal */
  public focus(options?: { select?: boolean }) {
    const element = this.elementRef.nativeElement;

    element.focus({ preventScroll: true });

    if (options?.select) {
      element.select();
    }
  }

  /** @internal Focuses the input and appends a character typed while a node or result had focus. */
  public appendCharacter(character: string) {
    const element = this.elementRef.nativeElement;

    this.focus();
    element.value += character;
    this.cascader?.setSearchQuery(element.value);
  }

  public clear() {
    this.elementRef.nativeElement.value = '';
    this.cascader?.setSearchQuery('');
  }

  protected handleInput() {
    this.cascader?.setSearchQuery(this.elementRef.nativeElement.value);
  }

  protected handleKeydown(event: KeyboardEvent) {
    const cascader = this.cascader;

    if (!cascader || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    // Escape is owned by the cascader's document-level handler (clear first, close second);
    // printable keys, Home/End and ArrowLeft/Right stay native input editing
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        cascader.moveFocusFromSearch(1);

        return;
      }
      case 'ArrowUp': {
        event.preventDefault();
        cascader.moveFocusFromSearch(-1);

        return;
      }
      case 'Enter': {
        if (cascader.isSearching()) {
          event.preventDefault();
          cascader.activateFocusedSearchResult();
        }

        return;
      }
    }
  }
}
