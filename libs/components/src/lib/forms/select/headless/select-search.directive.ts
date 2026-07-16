import {
  DOCUMENT,
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  model,
  signal,
  untracked,
} from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectDirective } from './select.directive';

/**
 * Opts a select into search. `et-select` renders the input inline in the trigger (combobox
 * pattern): typing opens the panel and filters. Filtering behavior is controlled by the
 * select's `filterMode` (`internal` hides non-matching options, `external` leaves the option
 * list to the consumer via `queryChange`). With a search registered, this input *is* the
 * combobox — the trigger element drops its combobox role.
 */
@Directive({
  selector: 'input[etSelectSearch]',
  exportAs: 'etSelectSearch',
  host: {
    autocomplete: 'off',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-haspopup': 'listbox',
    '[attr.aria-expanded]': 'expanded()',
    '[attr.aria-controls]': 'controls()',
    '[attr.aria-activedescendant]': 'activeDescendant()',
    '[attr.aria-required]': 'select?.required() || null',
    '[attr.aria-invalid]': 'select?.shouldDisplayError() || null',
    '[attr.aria-describedby]': 'select?.describedById() || null',
    '[attr.aria-labelledby]': 'select?.labelId() || null',
    '[disabled]': 'select?.disabled() || false',
    '[readOnly]': 'select?.readonly() || false',
    '(input)': 'handleInput()',
    '(keydown)': 'handleKeydown($event)',
    '(focus)': 'handleFocus()',
    '(blur)': 'handleBlur()',
  },
})
export class SelectSearchDirective {
  protected select = inject(SelectDirective, { optional: true });
  private document = inject(DOCUMENT);
  public elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  public query = model('');

  // single select doubles the input as the value display: the selected label shows while
  // the query is untouched, and the first edit replaces it
  private edited = signal(false);

  protected expanded = computed(() => this.select?.open() ?? false);
  protected controls = computed(() => (this.select?.open() ? this.select.listboxId() : null));
  protected activeDescendant = computed(() => (this.select?.open() ? this.select.activeId() : null));

  constructor() {
    this.select?.registeredSearch.set(this);

    this.destroyRef.onDestroy(() => {
      if (this.select?.registeredSearch() === this) {
        this.select.registeredSearch.set(null);
      }
    });

    effect(() => {
      const element = this.elementRef.nativeElement;
      const query = this.query();
      const select = this.select;
      let text = query;

      // single select: the input displays the selected value's label until the user edits —
      // unless a custom value template owns the display (an input cannot render rich HTML)
      if (select && !select.multiple() && !select.registeredValueTemplate() && !query && !this.edited()) {
        text = select.displayValue() ?? '';
      }

      if (element.value !== text) {
        element.value = text;
      }
    });

    effect(() => {
      const open = this.select?.open() ?? false;

      untracked(() => {
        if (!open) {
          this.edited.set(false);
        }
      });
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.select) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.SEARCH_OUTSIDE_SELECT,
            '[SelectSearchDirective] etSelectSearch must be placed inside an [etSelect] element.',
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
  public focus() {
    this.elementRef.nativeElement.focus({ preventScroll: true });
  }

  /** @internal Selects a displayed value label on open, so typing replaces it (single select). */
  public handleOpened() {
    if (this.edited() || this.select?.multiple() || this.select?.registeredValueTemplate()) {
      return;
    }

    const element = this.elementRef.nativeElement;

    if (element.value) {
      element.select();
    }
  }

  public clear() {
    // no direct element.value write — the display effect owns the element (it may need to
    // show the selected value's label instead of the empty query)
    this.query.set('');
    this.select?.queryChange.emit('');
  }

  protected handleInput() {
    const value = this.elementRef.nativeElement.value;
    const select = this.select;

    this.edited.set(true);
    this.query.set(value);
    select?.queryChange.emit(value);

    // single select: the input doubles as the value display, so the user erasing all of
    // its text clears the selection (Escape/close clears revert the display instead — they
    // don't go through this handler). With a custom value template the input is a pure
    // query box and clearing it must not deselect.
    if (!value && select && !select.multiple() && !select.registeredValueTemplate() && select.hasValue()) {
      select.deselectValue(select.value());
    }

    // typing opens the panel — the combobox pattern
    select?.show();
  }

  protected handleKeydown(event: KeyboardEvent) {
    // Backspace with nothing left to edit deletes from the selection instead: the last
    // chip in multi mode, the selected value in single mode (a custom value template
    // keeps the input empty, so this is the only way to delete by keyboard)
    if (event.key === 'Backspace' && !this.elementRef.nativeElement.value) {
      const select = this.select;

      if (!select || select.disabled() || select.readonly()) {
        return;
      }

      const lastEntry = select.selectedEntries().at(-1);

      if (lastEntry) {
        event.preventDefault();
        select.deselectValue(lastEntry.value);
      }

      return;
    }

    // Escape is owned by the select's document-level handler (clear first, close second);
    // printable keys, Home/End and ArrowLeft/Right stay native input editing
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === 'Tab') {
      this.select?.handleTriggerKeydown(event);
    }
  }

  protected handleFocus() {
    this.select?.triggerFocused.set(true);
  }

  protected handleBlur() {
    this.select?.triggerFocused.set(false);

    if (!this.select?.open()) {
      this.select?.touched.set(true);
    }
  }
}
