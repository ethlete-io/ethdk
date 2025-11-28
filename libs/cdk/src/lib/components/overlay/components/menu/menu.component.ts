import { DOWN_ARROW, END, HOME, LEFT_ARROW, RIGHT_ARROW, TAB, UP_ARROW } from '@angular/cdk/keycodes';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  contentChildren,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  input,
  OnDestroy,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { nextFrame, NgClassType } from '@ethlete/core';
import { fromEvent, tap } from 'rxjs';
import { INPUT_TOKEN } from '../../../forms/directives/input';
import { ScrollableComponent } from '../../../scrollable/components/scrollable';
import { injectFocusRegistry } from '../../utils';
import { MENU_ITEM_TOKEN, MenuItemDirective } from './menu-item.directive';
import { MENU_SEARCH_TEMPLATE_TOKEN } from './menu-search-template.directive';
import { MENU_TRIGGER_TOKEN } from './menu-trigger.directive';

export const MENU = new InjectionToken<MenuComponent>('ET_MENU');

let uniqueId = 0;

@Component({
  selector: 'et-menu',
  template: `
    @if (menuSearchTemplate(); as tpl) {
      <div class="et-menu-search-container">
        <ng-container *ngTemplateOutlet="tpl.templateRef" />
      </div>
    }

    <et-scrollable
      [direction]="orientation()"
      [renderButtons]="renderScrollableButtons()"
      [renderMasks]="renderScrollableMasks()"
      [cursorDragScroll]="orientation() === 'horizontal'"
      [scrollableClass]="scrollableClass()"
      renderScrollbars
    >
      <ng-content />
    </et-scrollable>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-menu',
    role: 'menu',
    '[id]': 'id',
    '[attr.aria-labelledby]': '_trigger.id',
    '[attr.aria-orientation]': 'orientation()',
    '[class.et-menu--has-search]': 'menuSearchTemplate()',
  },
  imports: [ScrollableComponent, NgTemplateOutlet],
  providers: [
    {
      provide: MENU,
      useExisting: MenuComponent,
    },
  ],

  styles: `
    .et-menu {
      --et-menu-max-inline-size: 300px;
      --et-menu-max-block-size: 200px;
      --et-menu-background-color: #b3b3b3;
      --et-menu-border-radius: 10px;

      max-inline-size: var(--et-menu-max-inline-size);
      max-block-size: min(var(--et-menu-max-block-size), var(--et-floating-max-height, var(--et-menu-max-block-size)));
      background-color: var(--et-menu-background-color);
      border-radius: var(--et-menu-border-radius);

      box-sizing: border-box;
      display: grid;
      grid-template-rows: minmax(0, 1fr);
      overflow: hidden;

      &.et-menu--has-search {
        grid-template-rows: auto minmax(0, 1fr);
      }
    }
  `,
})
export class MenuComponent implements OnDestroy {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private focusRegistry = injectFocusRegistry();

  _trigger = inject(MENU_TRIGGER_TOKEN);

  id = `et-menu-${uniqueId++}`;
  renderScrollableMasks = input(false, { transform: booleanAttribute });
  renderScrollableButtons = input(false, { transform: booleanAttribute });
  orientation = input<'horizontal' | 'vertical'>('vertical');
  scrollableClass = input<NgClassType | null>(null);

  menuItemList = contentChildren<MenuItemDirective>(MENU_ITEM_TOKEN, { descendants: true });
  menuSearchTemplate = contentChild(MENU_SEARCH_TEMPLATE_TOKEN);
  searchInput = contentChild(INPUT_TOKEN);

  elementsIfIsCurrentFocusTarget = this.focusRegistry.currentFocusTarget(this.id);

  constructor() {
    this._trigger._connectWithMenu(this);

    fromEvent(this.elementRef.nativeElement, 'focus')
      .pipe(
        takeUntilDestroyed(),
        tap(() => this.focusFirstItem()),
      )
      .subscribe();

    fromEvent<KeyboardEvent>(this.elementRef.nativeElement, 'keydown')
      .pipe(
        takeUntilDestroyed(),
        tap((e) => this._handleKeydown(e)),
      )
      .subscribe();

    const initialFocusEffectRef = effect(() => {
      const items = this.menuItemList();
      const searchInput = this.searchInput();
      const firstItem = items?.[0];

      nextFrame(() => {
        if (searchInput) {
          searchInput.focusInputVia();
          initialFocusEffectRef.destroy();

          const nativeEl = searchInput.nativeInputRef?.element.nativeElement;

          if (!nativeEl) return;

          this.focusRegistry.register({
            id: this.id,
            afterOpenFocus: nativeEl,
            afterCloseFocus: this._trigger.elementRef.nativeElement,
          });
        } else if (firstItem) {
          firstItem.focus();
          initialFocusEffectRef.destroy();

          this.focusRegistry.register({
            id: this.id,
            afterOpenFocus: firstItem.elementRef.nativeElement,
            afterCloseFocus: this._trigger.elementRef.nativeElement,
          });
        }
      });
    });
  }

  ngOnDestroy(): void {
    this._trigger._clearMenuConnection();

    this.elementsIfIsCurrentFocusTarget()?.afterCloseFocus.focus();

    this.focusRegistry.unregister(this.id);
  }

  focusFirstItem() {
    this.menuItemList()?.[0]?.focus();
  }

  focusLastItem() {
    const items = this.menuItemList();
    if (!items || items.length === 0) return;

    items[items.length - 1]?.focus();
  }

  focusNextItem() {
    const items = this.menuItemList();

    if (!items) return;

    const activeItem = items.findIndex((item) => item.isFocused());

    if (activeItem === -1) {
      this.focusFirstItem();
      return;
    }

    const nextItem = items[activeItem + 1];

    if (nextItem) {
      nextItem.focus();
    } else {
      const searchInput = this.searchInput();

      if (searchInput) {
        if (searchInput.isFocusedVia) {
          this.menuItemList()?.[0]?.focus();
        } else {
          this.searchInput()?.focusInputVia();
        }

        return;
      }

      this.focusFirstItem();
    }
  }

  focusPreviousItem() {
    const items = this.menuItemList();

    if (!items) return;

    const activeItem = items.findIndex((item) => item.isFocused());

    if (activeItem === -1) {
      this.focusLastItem();
      return;
    }

    const previousItem = items[activeItem - 1];

    if (previousItem) {
      previousItem.focus();
    } else {
      const searchInput = this.searchInput();

      if (searchInput) {
        if (searchInput.isFocusedVia) {
          this.focusLastItem();
        } else {
          this.searchInput()?.focusInputVia();
        }

        return;
      }

      this.focusLastItem();
    }
  }

  _handleKeydown(event: KeyboardEvent) {
    const keyCode = event.keyCode;

    switch (keyCode) {
      case DOWN_ARROW:
      case RIGHT_ARROW:
        this.focusNextItem();
        event.preventDefault();
        break;

      case UP_ARROW:
      case LEFT_ARROW:
        this.focusPreviousItem();
        event.preventDefault();
        break;

      case HOME:
        this.focusFirstItem();
        event.preventDefault();
        break;

      case END:
        this.focusLastItem();
        event.preventDefault();
        break;

      case TAB:
        this._trigger.unmount();

        break;
    }
  }
}
