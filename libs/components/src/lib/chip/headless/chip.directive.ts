import {
  DOCUMENT,
  DestroyRef,
  Directive,
  ElementRef,
  EnvironmentInjector,
  afterNextRender,
  booleanAttribute,
  inject,
  input,
  output,
} from '@angular/core';
import { CHIP_REMOVE_FOCUS_FALLBACK } from './chip.tokens';

const CHIPS_BY_ELEMENT = /* @__PURE__ */ new WeakMap<Element, ChipDirective>();

@Directive({
  selector: '[etChip]',
  exportAs: 'etChip',
  host: {
    '[attr.data-disabled]': 'disabled() || null',
    '[attr.data-removable]': 'removable() || null',
    '[attr.aria-disabled]': 'disabled() || null',
    '(keydown.backspace)': 'handleRemoveKey($event)',
    '(keydown.delete)': 'handleRemoveKey($event)',
  },
})
export class ChipDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private document = inject(DOCUMENT);
  private environmentInjector = inject(EnvironmentInjector);
  private focusFallback = inject(CHIP_REMOVE_FOCUS_FALLBACK, { optional: true });

  public disabled = input(false, { transform: booleanAttribute });
  public removable = input(false, { transform: booleanAttribute });
  public remove = output<void>();

  private focusSuccessors: ChipDirective[] | null = null;
  private removeControl: HTMLElement | null = null;

  constructor() {
    const host = this.elementRef.nativeElement;

    CHIPS_BY_ELEMENT.set(host, this);

    inject(DestroyRef).onDestroy(() => {
      CHIPS_BY_ELEMENT.delete(host);

      const successors = this.focusSuccessors;

      if (successors) {
        afterNextRender(() => this.handOffFocus(successors), { injector: this.environmentInjector });
      }
    });
  }

  public requestRemove() {
    if (this.disabled() || !this.removable()) {
      return;
    }

    this.emitRemove();
  }

  /** @internal The element that takes focus when a removed neighbour hands it over, if any. */
  public focusTarget() {
    const host = this.elementRef.nativeElement;

    if (!host.isConnected) {
      return null;
    }

    if (host.hasAttribute('tabindex') && host.tabIndex >= 0) {
      return host;
    }

    const removeControl = this.removeControl;

    if (removeControl && removeControl.tabIndex >= 0 && !removeControl.matches(':disabled')) {
      return removeControl;
    }

    return null;
  }

  /** @internal */
  public registerRemoveControl(element: HTMLElement | null) {
    this.removeControl = element;
  }

  protected handleRemoveKey(event: Event) {
    if (this.disabled() || !this.removable()) {
      return;
    }

    event.preventDefault();
    this.emitRemove();
  }

  private emitRemove() {
    const host = this.elementRef.nativeElement;

    this.focusSuccessors = host.contains(this.document.activeElement) ? this.siblingChipsNearestFirst() : null;
    this.remove.emit();
  }

  private siblingChipsNearestFirst() {
    const host = this.elementRef.nativeElement;
    const siblings = Array.from(host.parentElement?.children ?? []);
    const index = siblings.indexOf(host);
    const toChips = (elements: Element[]) =>
      elements.map((element) => CHIPS_BY_ELEMENT.get(element)).filter((chip) => chip !== undefined);

    return [...toChips(siblings.slice(index + 1)), ...toChips(siblings.slice(0, index).reverse())];
  }

  private handOffFocus(successors: ChipDirective[]) {
    const active = this.document.activeElement;

    if (active && active !== this.document.body) {
      return;
    }

    for (const chip of successors) {
      const target = chip.focusTarget();

      if (target) {
        target.focus();

        return;
      }
    }

    this.focusFallback?.();
  }
}
