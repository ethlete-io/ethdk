import { afterNextRender, computed, DestroyRef, Directive, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { tap, timer } from 'rxjs';
import { TabBarTriggerDirective } from './tab-bar-trigger.directive';
import { TAB_BAR_TOKEN } from './tab-bar.tokens';
import {
  TAB_BAR_FITS,
  TAB_BAR_ORIENTATIONS,
  TAB_BAR_VARIANTS,
  TabBarFit,
  TabBarOrientation,
  TabBarVariant,
} from './tab-bar.types';

let nextTabBarId = 0;

@Directive({
  selector: '[etTabBar]',
  providers: [{ provide: TAB_BAR_TOKEN, useExisting: TabBarDirective }],
  host: {
    role: 'tablist',
    '[attr.aria-orientation]': 'orientation()',
    '(keydown)': 'handleKeydown($event)',
    '(focusout)': 'handleFocusout($event)',
  },
})
export class TabBarDirective {
  private destroyRef = inject(DestroyRef);

  public orientation = input<TabBarOrientation>(TAB_BAR_ORIENTATIONS.HORIZONTAL);
  public fit = input<TabBarFit>(TAB_BAR_FITS.CONTENT);
  public variant = input<TabBarVariant>(TAB_BAR_VARIANTS.SECONDARY);
  public divider = input(true);
  /** @internal */
  public triggers = signal<TabBarTriggerDirective[]>([]);
  /** @internal */
  public focusedIndex = signal(-1);
  public selectedIndex = signal(0);

  /** @internal */
  public readonly ID = `et-tab-bar-${nextTabBarId++}`;

  /** @internal */
  public lastActiveUnderlineElement = signal<HTMLElement | null>(null);

  /** @internal */
  public animationsReady = signal(false);

  public activeTrigger = computed(() => {
    const idx = this.selectedIndex();
    const all = this.triggers();

    return all[idx] ?? null;
  });

  constructor() {
    afterNextRender(() => {
      timer(0)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          tap(() => {
            this.animationsReady.set(true);
          }),
        )
        .subscribe();
    });
  }

  /** @internal */
  public registerTrigger(trigger: TabBarTriggerDirective) {
    this.triggers.update((list) => [...list, trigger]);
  }

  /** @internal */
  public unregisterTrigger(trigger: TabBarTriggerDirective) {
    this.triggers.update((list) => list.filter((t) => t !== trigger));
  }

  /** @internal */
  public selectTrigger(trigger: TabBarTriggerDirective) {
    const idx = this.triggers().indexOf(trigger);

    if (idx !== -1) {
      this.selectedIndex.set(idx);
    }
  }

  public handleKeydown(event: KeyboardEvent) {
    const isHorizontal = this.orientation() === TAB_BAR_ORIENTATIONS.HORIZONTAL;
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';

    if (event.key === nextKey) {
      event.preventDefault();
      this.moveFocus(1);
    } else if (event.key === prevKey) {
      event.preventDefault();
      this.moveFocus(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.focusFirst();
    } else if (event.key === 'End') {
      event.preventDefault();
      this.focusLast();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.activateFocused();
    }
  }

  public handleFocusout(event: FocusEvent) {
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    const triggers = this.triggers();
    const isFocusStillInBar = relatedTarget !== null && triggers.some((t) => t.getElement() === relatedTarget);

    if (!isFocusStillInBar) {
      this.focusedIndex.set(-1);
    }
  }

  private moveFocus(direction: 1 | -1) {
    const all = this.triggers();

    if (all.length === 0) {
      return;
    }

    let currentIndex = this.focusedIndex();

    if (currentIndex === -1) {
      currentIndex = this.selectedIndex();
    }

    let nextIndex = currentIndex;
    const length = all.length;

    for (let i = 0; i < length; i++) {
      nextIndex = (nextIndex + direction + length) % length;
      const trigger = all[nextIndex];

      if (trigger && !trigger.disabled()) {
        this.focusedIndex.set(nextIndex);
        trigger.focus();

        return;
      }
    }
  }

  private focusFirst() {
    const all = this.triggers();

    for (let i = 0; i < all.length; i++) {
      const trigger = all[i];

      if (trigger && !trigger.disabled()) {
        this.focusedIndex.set(i);
        trigger.focus();

        return;
      }
    }
  }

  private focusLast() {
    const all = this.triggers();

    for (let i = all.length - 1; i >= 0; i--) {
      const trigger = all[i];

      if (trigger && !trigger.disabled()) {
        this.focusedIndex.set(i);
        trigger.focus();

        return;
      }
    }
  }

  private activateFocused() {
    const idx = this.focusedIndex();

    if (idx === -1) {
      return;
    }

    const trigger = this.triggers()[idx];

    if (trigger && !trigger.disabled()) {
      trigger.getElement().click();
    }
  }
}
