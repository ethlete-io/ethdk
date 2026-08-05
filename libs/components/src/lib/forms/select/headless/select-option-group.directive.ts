import { Directive, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectDirective } from './select.directive';

/** The subset of an option a group needs to track its visibility. */
export type SelectOptionGroupItem = {
  filteredOut: () => boolean;
};

/**
 * Groups a set of `[etSelectOption]`s under a labelled `role="group"` section. Purely
 * presentational - options still register flat with the select, so keyboard navigation and
 * typeahead run across the whole list. With internal filtering the group hides itself once
 * all of its options are filtered out.
 */
@Directive({
  selector: '[etSelectOptionGroup]',
  exportAs: 'etSelectOptionGroup',
  host: {
    role: 'group',
    '[attr.aria-labelledby]': 'labelledById()',
    '[attr.aria-label]': 'labelledById() ? null : label() || null',
    '[hidden]': 'isHidden()',
    '[attr.data-hidden]': 'isHidden() || null',
  },
})
export class SelectOptionGroupDirective {
  private readonly hostElement = injectHostElement();

  private select = inject(SelectDirective, { optional: true });

  /** The group's accessible name - also the default header text in `et-select-option-group`. */
  public label = input('');

  /** @internal Set by the rendered label element so `aria-labelledby` points at it. */
  public labelledById = signal<string | null>(null);

  /** Options that registered themselves with this group. */
  private options = signal<readonly SelectOptionGroupItem[]>([]);

  /** Whether any of the group's options are currently shown (false hides the whole group). */
  public hasVisibleOptions = computed(() => {
    const options = this.options();

    return options.length === 0 || options.some((option) => !option.filteredOut());
  });

  public isHidden = computed(() => !this.hasVisibleOptions());

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.select) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.OPTION_GROUP_OUTSIDE_SELECT,
            '[SelectOptionGroupDirective] etSelectOptionGroup must be placed inside an [etSelect] element.',
            { element: this.hostElement },
          );
        }
      });
    }
  }

  /** @internal */
  public registerOption(option: SelectOptionGroupItem) {
    this.options.update((options) => [...options, option]);
  }

  /** @internal */
  public unregisterOption(option: SelectOptionGroupItem) {
    this.options.update((options) => options.filter((registered) => registered !== option));
  }
}
