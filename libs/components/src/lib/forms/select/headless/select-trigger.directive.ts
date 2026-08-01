import { Directive, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { registerSingleton } from '../../form-field/headless';
import { RuntimeError, createComponentId } from '@ethlete/core';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectDirective } from './select.directive';

@Directive({
  selector: '[etSelectTrigger]',
  exportAs: 'etSelectTrigger',
  host: {
    '[attr.role]': 'role()',
    '[attr.aria-haspopup]': 'hasSearch() ? null : "listbox"',
    '[attr.aria-expanded]': 'expanded()',
    '[attr.aria-controls]': 'controls()',
    '[attr.aria-activedescendant]': 'activeDescendant()',
    '[attr.aria-required]': 'hasSearch() ? null : select?.required() || null',
    '[attr.aria-invalid]': 'hasSearch() ? null : select?.shouldDisplayError() || null',
    '[attr.aria-describedby]': 'hasSearch() ? null : select?.describedBy() || null',
    '[attr.aria-labelledby]': 'labelledBy()',
    '[attr.aria-disabled]': 'select?.disabled() || null',
    '[attr.data-disabled]': 'select?.disabled() || null',
    '[attr.data-readonly]': 'select?.readonly() || null',
    '[attr.tabindex]': 'tabIndex()',
    '[attr.data-select-open]': 'isOpen() || null',
    '(click)': 'handleClick()',
    '(keydown)': 'handleKeydown($event)',
    '(focus)': 'handleFocus()',
    '(blur)': 'handleBlur()',
  },
})
export class SelectTriggerDirective {
  /** @internal */
  public select = inject(SelectDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  // with an inline search input, the input is the combobox and the tab stop -
  // the trigger element becomes a plain container
  protected hasSearch = computed(() => !!this.select?.registeredSearch());

  protected role = computed(() => (this.hasSearch() ? null : 'combobox'));
  protected expanded = computed(() => (this.hasSearch() ? null : (this.select?.open() ?? false)));
  protected controls = computed(() => (!this.hasSearch() && this.select?.open() ? this.select.listboxId() : null));
  protected activeDescendant = computed(() =>
    !this.hasSearch() && this.select?.open() ? this.select.activeId() : null,
  );

  // non-button hosts (a chips trigger must not be a native <button> - chips contain remove
  // buttons, and buttons cannot nest) need their focusability managed explicitly
  private readonly IS_NATIVELY_FOCUSABLE = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(
    this.elementRef.nativeElement.tagName,
  );

  protected tabIndex = computed(() => {
    if (this.IS_NATIVELY_FOCUSABLE || this.hasSearch()) {
      return null;
    }

    return this.select?.disabled() ? -1 : 0;
  });

  protected labelledBy = computed(() => {
    if (this.hasSearch()) {
      return null;
    }

    const labelId = this.select?.labelId();

    return labelId ? `${labelId} ${this.elementRef.nativeElement.id}` : null;
  });

  constructor() {
    const element = this.elementRef.nativeElement;

    if (!element.id) {
      element.id = createComponentId('et-select-trigger');
    }

    registerSingleton(this.select?.registeredTrigger, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.select) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.TRIGGER_OUTSIDE_SELECT,
            '[SelectTriggerDirective] etSelectTrigger must be placed inside an [etSelect] element.',
          );
        }
      });
    }
  }

  public isOpen() {
    return this.select?.open() ?? false;
  }

  protected handleClick() {
    const search = this.select?.registeredSearch();

    if (search) {
      // clicking anywhere in the field focuses the inline search input; clicks inside the
      // input itself must never close the panel - the chevron's own handler toggles instead
      this.select?.show();
      search.focus();

      return;
    }

    this.select?.toggle();
  }

  protected handleKeydown(event: KeyboardEvent) {
    // an inline search input forwards its own relevant keys - don't double-handle them
    if (this.select?.registeredSearch()?.isFocused()) {
      return;
    }

    this.select?.handleTriggerKeydown(event);
  }

  protected handleFocus() {
    this.select?.triggerFocused.set(true);
  }

  protected handleBlur() {
    this.select?.triggerFocused.set(false);

    // focus moving into the panel (the search input) is not "leaving the field"
    if (!this.select?.open()) {
      this.select?.touched.set(true);
    }
  }
}
