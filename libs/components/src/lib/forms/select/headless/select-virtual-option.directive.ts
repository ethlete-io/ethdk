import { Directive, ElementRef, afterNextRender, computed, effect, inject, input, untracked } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectDirective } from './select.directive';
import { SelectItem } from './select.tokens';

/**
 * Renders one select-owned item (an entry of `virtualizedItems()`, data-driven `options`
 * mode) as a listbox option. Unlike `etSelectOption` it registers nothing — the item
 * already lives in the select's registry; this directive wires the rendered row to it
 * (ARIA attributes, active/selected state, pointer handling) while the row is inside the
 * virtual window.
 */
@Directive({
  selector: '[etSelectVirtualOption]',
  exportAs: 'etSelectVirtualOption',
  host: {
    role: 'option',
    '[attr.id]': 'item().id()',
    '[attr.aria-selected]': 'selected()',
    '[attr.aria-disabled]': 'item().disabled() || null',
    '[attr.data-selected]': 'selected() || null',
    '[attr.data-active]': 'active() || null',
    '[attr.data-active-source]': 'activeSource()',
    '(click)': 'handleClick($event)',
    '(mousedown)': 'handleMousedown($event)',
    '(pointerenter)': 'handlePointerEnter($event)',
  },
})
export class SelectVirtualOptionDirective {
  private select = inject(SelectDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public item = input.required<SelectItem>({ alias: 'etSelectVirtualOption' });

  // derived from the select's value instead of the item's `checked` (which the registry sync
  // effect writes after the fact) — a freshly windowed-in row must paint its selected state
  // on its very first frame
  public selected = computed(() => {
    const value = this.item().value();
    const current = this.select?.value();

    if (this.select?.mixed()) {
      return false;
    }

    return Array.isArray(current) ? current.includes(value) : current === value;
  });

  public active = computed(() => this.select?.activeItem() === this.item());
  protected activeSource = computed(() => (this.active() ? (this.select?.activeItemSource() ?? null) : null));

  constructor() {
    // the row adopts its item for the time it is rendered — the item's `element` feeds
    // active-item scrolling (scrollIntoView vs. window scroll) and row-height measurement
    effect((onCleanup) => {
      const item = this.item();
      const select = this.select;

      if (!select) {
        return;
      }

      const element = this.elementRef.nativeElement;

      untracked(() => select.attachVirtualOptionElement(item, element));
      onCleanup(() => select.detachVirtualOptionElement(item, element));
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.select) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.VIRTUAL_OPTION_OUTSIDE_SELECT,
            '[SelectVirtualOptionDirective] etSelectVirtualOption must be placed inside an [etSelect] element.',
          );
        }
      });
    }
  }

  protected handleClick(event: MouseEvent) {
    if (this.item().disabled()) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    this.select?.commitOption(this.item());
  }

  protected handleMousedown(event: MouseEvent) {
    // DOM focus stays on the trigger — options only ever hold virtual focus
    event.preventDefault();
  }

  protected handlePointerEnter(event: PointerEvent) {
    if (event.pointerType === 'touch' || this.item().disabled()) {
      return;
    }

    this.select?.setActiveItem(this.item(), { scroll: false, source: 'pointer' });
  }
}
