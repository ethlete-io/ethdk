import { Directive, ElementRef, computed, effect, inject, input, signal } from '@angular/core';
import { SurfaceInteractiveDirective } from '@ethlete/core';
import { ScrollableDirective } from '../../scrollable/headless/scrollable.directive';
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
    '[class.et-tab-bar-trigger--no-initial-transition]': '!tabBar.animationsReady()',
    '(click)': 'handleClick()',
    '(mouseleave)': 'justActivated.set(false)',
  },
})
export class TabBarTriggerDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private scrollable = inject(ScrollableDirective, { optional: true });
  protected tabBar = inject(TAB_BAR_TOKEN);

  disabled = input(false);

  readonly ID = `et-tab-trigger-${nextTriggerId++}`;

  justActivated = signal(false);

  isSelected = computed(() => {
    const idx = this.tabBar.triggers().indexOf(this);

    return idx === this.tabBar.selectedIndex();
  });

  tabIndex = computed(() => {
    const myIndex = this.tabBar.triggers().indexOf(this);
    const focusedIdx = this.tabBar.focusedIndex();

    if (focusedIdx !== -1) {
      return myIndex === focusedIdx ? 0 : -1;
    }

    return this.isSelected() ? 0 : -1;
  });

  constructor() {
    effect(() => {
      this.tabBar.registerTrigger(this);

      return () => this.tabBar.unregisterTrigger(this);
    });

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
  }

  /** @internal */
  focus() {
    this.elementRef.nativeElement.focus();
    this.scrollIntoView();
  }

  /** @internal */
  getElement() {
    return this.elementRef.nativeElement;
  }

  handleClick() {
    if (!this.disabled()) {
      const wasSelected = this.isSelected();

      this.tabBar.selectTrigger(this);

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
