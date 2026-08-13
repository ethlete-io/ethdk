import {
  DOCUMENT,
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
import { registerSingleton } from '../../form-field/headless';
import { RuntimeError } from '@ethlete/core';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectDirective } from './select.directive';

/**
 * Opts a select into search. `et-select` renders the input inline in the trigger (combobox
 * pattern): typing opens the panel and filters. Filtering behavior is controlled by the
 * select's `filterMode` (`internal` hides non-matching options, `external` leaves the option
 * list to the consumer via `queryChange`). With a search registered, this input *is* the
 * combobox - the trigger element drops its combobox role.
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
    '[attr.aria-describedby]': 'describedBy()',
    '[attr.aria-labelledby]': 'select?.labelId() || null',
    '[disabled]': 'select?.disabled() || false',
    '[readOnly]': 'select?.readonly() || isFull()',
    '(input)': 'handleInput()',
    '(keydown)': 'handleKeydown($event)',
    '(paste)': 'handlePaste($event)',
    '(focus)': 'handleFocus()',
    '(blur)': 'handleBlur()',
  },
})
export class SelectSearchDirective {
  protected select = inject(SelectDirective, { optional: true });
  private document = inject(DOCUMENT);
  public elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);

  public query = model('');

  // single select doubles the input as the value display: the selected label shows while
  // the query is untouched, and the first edit replaces it
  private edited = signal(false);

  protected expanded = computed(() => this.select?.open() ?? false);
  protected controls = computed(() => (this.select?.open() ? this.select.listboxId() : null));
  protected activeDescendant = computed(() => (this.select?.open() ? this.select.activeId() : null));
  // a full selection locks the input like the tag-input field - values leave via chips/Backspace
  protected isFull = computed(() => this.select?.isFull() ?? false);
  protected describedBy = computed(() => {
    const select = this.select;

    if (!select) {
      return null;
    }

    const ids = [select.describedBy()];

    if (select.mixed() && select.multiple() && this.isInlineInTrigger()) {
      ids.push(select.mixedLabelId());
    }

    return ids.filter((id): id is string => !!id).join(' ') || null;
  });

  // the last placeholder this directive wrote - anything else on the element came from the
  // consumer (a static attribute or their own binding) and owns it from then on
  private writtenPlaceholder: string | null = null;

  // an inline input replaces the trigger's value display, so it also has to carry the select's
  // placeholder - the trigger renders none while a search is registered
  private fallbackPlaceholder = computed(() => {
    const select = this.select;

    if (!select || !this.isInlineInTrigger() || select.hasValue()) {
      return '';
    }

    return select.placeholder();
  });

  constructor() {
    registerSingleton(this.select?.registeredSearch, this);

    effect(() => {
      const placeholder = this.fallbackPlaceholder();
      const element = this.elementRef.nativeElement;

      if (element.placeholder && element.placeholder !== this.writtenPlaceholder) {
        return;
      }

      this.writtenPlaceholder = placeholder;
      element.placeholder = placeholder;
    });

    effect(() => {
      const element = this.elementRef.nativeElement;
      const query = this.query();
      const select = this.select;
      let text = query;

      // single select: the input displays the selected value's label until the user edits.
      // A custom value template owns the resting display (an input cannot render rich HTML),
      // but while the field is focused it becomes editable text here too - so Backspace edits
      // the label instead of nuking the whole value (see `handleKeydown`). Panel-hosted search
      // inputs stay pure query boxes.
      if (
        select &&
        !select.multiple() &&
        (!select.registeredValueTemplate() || select.mixed() || select.focused()) &&
        !query &&
        !this.edited() &&
        this.isInlineInTrigger()
      ) {
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
            { element: this.elementRef.nativeElement },
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
  public focus(options?: FocusOptions) {
    this.elementRef.nativeElement.focus(options ?? { preventScroll: true });
  }

  /** @internal Selects a displayed value label on open, so typing replaces it (single select). */
  public handleOpened() {
    const select = this.select;

    if (this.edited() || !select || select.multiple() || !this.isInlineInTrigger()) {
      return;
    }

    const element = this.elementRef.nativeElement;

    // a custom value template kept the resting input empty (the rich display showed instead) -
    // now in edit mode the input becomes the editable label, so write it before the display
    // effect catches up so it can be selected for replace-on-type
    if (select.registeredValueTemplate() && !select.mixed() && !element.value) {
      element.value = select.displayValue() ?? '';
    }

    if (element.value) {
      element.select();
    }
  }

  public clear() {
    // no direct element.value write - the display effect owns the element (it may need to
    // show the selected value's label instead of the empty query)
    this.query.set('');
    this.select?.queryChange.emit('');
  }

  /** @internal Restores and selects the masked label after Escape without changing normal search behavior. */
  public restoreMixedDisplay() {
    const select = this.select;

    this.edited.set(false);
    this.clear();

    if (!select || select.multiple() || !this.isInlineInTrigger()) {
      return;
    }

    // Signal effects update the value after this event. Write it eagerly so the selection
    // range belongs to the restored label and the next keystroke replaces it.
    const element = this.elementRef.nativeElement;
    element.value = select.displayValue() ?? '';

    if (element.value) {
      element.select();
    }
  }

  protected handleInput() {
    const value = this.elementRef.nativeElement.value;
    const select = this.select;

    // typing a custom-value separator commits the text before it (tag-input parity)
    if (select?.allowCustomValues()) {
      const lastChar = value.at(-1);

      if (lastChar !== undefined && select.customValueSeparators().includes(lastChar)) {
        const pending = value.slice(0, -1);

        this.edited.set(true);
        this.elementRef.nativeElement.value = pending;
        this.query.set(pending);
        select.queryChange.emit(pending);

        // a rejected commit (duplicate, normalized away) keeps the pending text for editing -
        // with the panel open so the user sees why (e.g. the already-selected option)
        if (!pending || !select.commitCustomValue(pending)) {
          select.show();
        }

        return;
      }
    }

    this.edited.set(true);
    this.query.set(value);
    select?.queryChange.emit(value);

    // single select: the input doubles as the value display, so the user erasing all of its
    // text clears the selection (Escape/close clears revert the display instead - they don't
    // go through this handler). A custom value template shows the editable label here only
    // while focused, so erasing it deselects the same way. A panel-hosted search input is a
    // pure query box and clearing it must not deselect.
    if (!value && select && !select.multiple() && select.hasValue() && this.isInlineInTrigger()) {
      if (select.mixed()) {
        select.clearValue();
      } else {
        select.deselectValue(select.value());
      }
    }

    // typing opens the panel - the combobox pattern
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

      // while mixed there is no visible chip to delete - a lone Backspace must not nuke the
      // hidden raw selection of every edited record; the clear button stays the destructive path
      if (select.mixed()) {
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

  protected handlePaste(event: ClipboardEvent) {
    const select = this.select;
    const text = event.clipboardData?.getData('text/plain');

    // splitting only makes sense where several values can land - multi mode with custom values
    if (!select || !text || !select.allowCustomValues() || !select.multiple()) {
      return;
    }

    const separators = select.customValueSeparators();

    if (!separators.length && !text.includes('\n')) {
      return;
    }

    const pattern = new RegExp(
      `[\\n${separators.map((separator) => separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')}]`,
    );
    const parts = text.split(pattern);

    if (parts.length < 2) {
      return;
    }

    event.preventDefault();

    for (const part of parts) {
      select.commitCustomValue(part);
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

  // the input doubles as the value display only while it sits inline in the trigger (the
  // combobox-in-field pattern) - a search rendered inside the panel instead (e.g. the phone
  // input's country picker) is a pure query box and always shows its placeholder
  private isInlineInTrigger() {
    const trigger = this.select?.registeredTrigger()?.elementRef.nativeElement;

    return !!trigger && trigger.contains(this.elementRef.nativeElement);
  }
}
