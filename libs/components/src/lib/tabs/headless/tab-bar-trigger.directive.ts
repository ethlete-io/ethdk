import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RuntimeError, SurfaceInteractiveDirective } from '@ethlete/core';
import { ScrollableDirective } from '../../scrollable/headless/scrollable.directive';
import { TAB_ERROR_CODES } from '../tab-errors';
import { TAB_BAR_TOKEN, TAB_BAR_TRIGGER_TOKEN } from './tab-bar.tokens';

let nextTriggerId = 0;

@Directive({
  selector: '[etTabBarTrigger]',
  providers: [{ provide: TAB_BAR_TRIGGER_TOKEN, useExisting: TabBarTriggerDirective }],
  hostDirectives: [SurfaceInteractiveDirective],
  host: {
    role: 'tab',
    '[attr.id]': 'ID',
    '[attr.aria-selected]': 'isSelected()',
    '[attr.aria-disabled]': 'disabled() || null',
    '[attr.disabled]': 'disabled() || null',
    '[attr.tabindex]': 'tabIndex()',
    '[class.et-tab-bar-trigger--just-activated]': 'justActivated()',
    '[class.et-tab-bar-trigger--no-initial-transition]': '!tabBar?.animationsReady()',
    '(click)': 'handleClick()',
    '(mouseleave)': 'justActivated.set(false)',
  },
})
export class TabBarTriggerDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private scrollable = inject(ScrollableDirective, { optional: true });
  protected tabBar = inject(TAB_BAR_TOKEN, { optional: true });

  public disabled = input(false, { transform: booleanAttribute });

  public readonly ID = `et-tab-trigger-${nextTriggerId++}`;

  public justActivated = signal(false);

  /**
   * @internal Set when something else owns the selection - a router link, where a click only asks to
   * navigate and the selection has to wait until that navigation is actually committed.
   */
  public deferSelection = signal(false);

  public isSelected = computed(() => {
    const tabBar = this.tabBar;

    if (!tabBar) {
      return false;
    }

    const idx = tabBar.triggers().indexOf(this);

    return idx === tabBar.selectedIndex();
  });

  public tabIndex = computed(() => {
    const tabBar = this.tabBar;

    if (!tabBar) {
      return -1;
    }

    const myIndex = tabBar.triggers().indexOf(this);
    const focusedIdx = tabBar.focusedIndex();

    if (focusedIdx !== -1) {
      return myIndex === focusedIdx ? 0 : -1;
    }

    return this.isSelected() ? 0 : -1;
  });

  constructor() {
    this.tabBar?.registerTrigger(this);

    inject(DestroyRef).onDestroy(() => this.tabBar?.unregisterTrigger(this));

    effect(() => {
      if (!this.scrollable) {
        return;
      }

      if (!this.isSelected()) {
        return;
      }

      if (!this.scrollable.getScrollContainerRef()()) {
        return;
      }

      this.scrollIntoView();
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.tabBar) {
          throw new RuntimeError(
            TAB_ERROR_CODES.MISSING_TAB_BAR,
            '[TabBarTriggerDirective] etTabBarTrigger must be placed inside a tab bar (et-tab-group, et-nav-tabs, or an [etTabBar] element).',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  /** @internal */
  public focus() {
    this.elementRef.nativeElement.focus();
    this.scrollIntoView();
  }

  /** @internal */
  public getElement() {
    return this.elementRef.nativeElement;
  }

  public handleClick() {
    if (!this.disabled()) {
      const wasSelected = this.isSelected();

      if (!this.deferSelection()) {
        this.tabBar?.selectTrigger(this);
      }

      if (!wasSelected) {
        this.justActivated.set(true);
      }
    }
  }

  private scrollIntoView() {
    if (!this.scrollable) {
      return;
    }

    this.scrollable.scrollToElement({
      element: this.elementRef.nativeElement,
      origin: 'center',
    });
  }
}
