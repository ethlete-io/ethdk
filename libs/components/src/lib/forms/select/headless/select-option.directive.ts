import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RuntimeError, createComponentId } from '@ethlete/core';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectOptionGroupDirective } from './select-option-group.directive';
import { SelectDirective } from './select.directive';

/**
 * Placeholder an option's value resolves to while its required `value` input has not been
 * bound yet (projected content whose view has not rendered). Never matches a consumer value,
 * so unbound options simply cannot be selected until their bindings run.
 */
const UNBOUND_VALUE = Symbol('et-select-option-unbound');

@Directive({
  selector: '[etSelectOption]',
  exportAs: 'etSelectOption',
  host: {
    role: 'option',
    '[attr.aria-selected]': 'selected()',
    '[attr.aria-disabled]': 'isDisabled() || null',
    '[attr.data-selected]': 'selected() || null',
    '[attr.data-active]': 'active() || null',
    '[attr.data-active-source]': 'activeSource()',
    '[attr.data-filtered]': 'filteredOut() || null',
    '(click)': 'handleClick($event)',
    '(mousedown)': 'handleMousedown($event)',
    '(pointerenter)': 'handlePointerEnter($event)',
  },
})
export class SelectOptionDirective {
  private select = inject(SelectDirective, { optional: true });
  private group = inject(SelectOptionGroupDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  public value = input.required<unknown>();
  /** Display label. Falls back to the element's text content rendered on first paint. */
  public labelInput = input('', { alias: 'label' });
  public disabled = input(false, { transform: booleanAttribute });
  /**
   * Marks the option as the select's "Create …" row for the current `customValueCandidate` —
   * it is excluded from the candidate's duplicate-label check (it would otherwise hide
   * itself, since its label *is* the candidate).
   */
  public customValueOption = input(false, { transform: booleanAttribute });

  private optionId = signal(createComponentId('et-select-option'));
  private textLabel = signal('');

  public label = computed(() => this.labelInput() || this.textLabel());
  public checked = signal(false);

  // the required `value` input throws until its binding executes — which never happens for
  // projected options whose view is not rendered (a lazy, closed surface). Reading through
  // this computed keeps registry-wide reads (value↔checked sync, label cache) crash-free.
  private boundValue = computed(() => {
    try {
      return this.value();
    } catch {
      return UNBOUND_VALUE;
    }
  });

  // derived from the select's value instead of `checked` (which the registry sync effect only
  // writes after the first render) — the overlay's fresh option instances must paint their
  // selected state correctly on the very first frame of the enter animation
  public selected = computed(() => {
    const value = this.boundValue();

    if (!this.select) {
      return this.checked();
    }

    if (value === UNBOUND_VALUE) {
      return this.select.mixed() ? false : this.checked();
    }

    return this.select.isValueSelected(value);
  });

  /**
   * The option's effective interactivity: its own `disabled` input, or — once `maxSelection`
   * is reached in multi mode — every still-unselected option, so the remaining choices read
   * as unavailable instead of silently ignoring clicks. Selected options stay enabled for
   * deselection; keyboard navigation skips full options like any other disabled option.
   */
  public isDisabled = computed(() => {
    if (this.disabled()) {
      return true;
    }

    return !!this.select && this.select.isFull() && !this.selected();
  });

  private listItem = {
    value: this.boundValue,
    checked: this.checked,
    disabled: this.isDisabled,
    element: signal(this.elementRef.nativeElement).asReadonly(),
    id: this.optionId.asReadonly(),
    label: this.label,
    custom: this.customValueOption,
  };
  public active = computed(() => this.select?.activeItem() === this.listItem);
  protected activeSource = computed(() => (this.active() ? (this.select?.activeItemSource() ?? null) : null));

  /** With internal filtering, true while the option does not match the search query. Hide it via CSS. */
  public filteredOut = computed(() => {
    const select = this.select;

    if (!select || select.filterMode() !== 'internal') {
      return false;
    }

    // panelFilterQuery, not the live query: the filter freezes while the panel animates out
    const query = select.panelFilterQuery();

    return !!query && !this.label().toLowerCase().includes(query);
  });

  constructor() {
    const element = this.elementRef.nativeElement;

    if (!element.id) {
      element.id = this.optionId();
    }

    const select = this.select;

    if (select) {
      select.selection.registerItem(this.listItem);

      this.destroyRef.onDestroy(() => {
        if (select.activeItem() === this.listItem) {
          select.activeItem.set(null);
        }

        select.selection.unregisterItem(this.listItem);
      });
    }

    const group = this.group;

    if (group) {
      const groupItem = { filteredOut: () => this.filteredOut() };

      group.registerOption(groupItem);
      this.destroyRef.onDestroy(() => group.unregisterOption(groupItem));
    }

    afterNextRender(() => {
      this.textLabel.set(element.textContent?.trim() ?? '');
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.select) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.OPTION_OUTSIDE_SELECT,
            '[SelectOptionDirective] etSelectOption must be placed inside an [etSelect] element.',
          );
        }
      });
    }
  }

  protected handleClick(event: MouseEvent) {
    if (this.isDisabled()) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    this.select?.commitOption(this.listItem);
  }

  protected handleMousedown(event: MouseEvent) {
    // DOM focus stays on the trigger — options only ever hold virtual focus
    event.preventDefault();
  }

  protected handlePointerEnter(event: PointerEvent) {
    if (event.pointerType === 'touch' || this.isDisabled()) {
      return;
    }

    this.select?.setActiveItem(this.listItem, { scroll: false, source: 'pointer' });
  }
}
