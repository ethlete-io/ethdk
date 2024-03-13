import { DOWN_ARROW, END, HOME, LEFT_ARROW, RIGHT_ARROW, TAB, UP_ARROW } from '@angular/cdk/keycodes';
import {
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  ElementRef,
  InjectionToken,
  Input,
  OnDestroy,
  ViewEncapsulation,
  booleanAttribute,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClassType, TypedQueryList, signalHostAttributes } from '@ethlete/core';
import { fromEvent, tap } from 'rxjs';
import { ScrollableComponent } from '../../../../../scrollable/components/scrollable';
import { MENU_ITEM_TOKEN, MenuItemDirective } from '../../directives/menu-item';
import { MENU_TRIGGER_TOKEN } from '../../directives/menu-trigger';

export const MENU = new InjectionToken<MenuComponent>('ET_MENU');

let uniqueId = 0;

@Component({
  selector: 'et-menu',
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-menu',
    role: 'menu',
    '[id]': 'id',
    '[attr.aria-labelledby]': '_trigger.id',
  },
  imports: [ScrollableComponent],
  providers: [
    {
      provide: MENU,
      useExisting: MenuComponent,
    },
  ],
})
export class MenuComponent implements OnDestroy {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly _trigger = inject(MENU_TRIGGER_TOKEN);

  @Input({ alias: 'id' })
  private set __id(value: string) {
    this.id.set(value);
  }
  readonly id = signal<string>(`et-menu-${uniqueId++}`);

  @Input({ transform: booleanAttribute, alias: 'renderScrollableMasks' })
  private set __renderScrollableMasks(v: boolean) {
    this.renderScrollableMasks.set(v);
  }
  readonly renderScrollableMasks = signal(false);

  @Input({ transform: booleanAttribute, alias: 'renderScrollableButtons' })
  private set __renderScrollableButtons(v: boolean) {
    this.renderScrollableButtons.set(v);
  }
  readonly renderScrollableButtons = signal(false);

  @Input({ alias: 'scrollableClass' })
  set _scrollableClass(v: NgClassType | null) {
    this.scrollableClass.set(v);
  }
  readonly scrollableClass = signal<NgClassType | null>(null);

  @ContentChildren(MENU_ITEM_TOKEN, { descendants: true })
  private set __menuItemList(value: TypedQueryList<MenuItemDirective>) {
    this._menuItemList.set(value);
  }
  private readonly _menuItemList = signal<TypedQueryList<MenuItemDirective> | null>(null);

  @Input({ alias: 'orientation' })
  private set __orientation(value: 'horizontal' | 'vertical') {
    this.orientation.set(value);
  }
  readonly orientation = signal<'horizontal' | 'vertical'>('vertical');

  readonly hostAttributeBindings = signalHostAttributes({
    id: this.id,
    'aria-orientation': this.orientation,
  });

  constructor() {
    this._trigger._connectWithMenu(this);

    fromEvent(this._elementRef.nativeElement, 'focus')
      .pipe(
        takeUntilDestroyed(),
        tap(() => this.focusFirstItem()),
      )
      .subscribe();

    fromEvent<KeyboardEvent>(this._elementRef.nativeElement, 'keydown')
      .pipe(
        takeUntilDestroyed(),
        tap((e) => this._handleKeydown(e)),
      )
      .subscribe();

    const initialFocusEffectRef = effect(
      () => {
        const items = this._menuItemList();
        const firstItem = items?.first;

        if (firstItem) {
          firstItem.focus();
          initialFocusEffectRef.destroy();
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnDestroy(): void {
    this._trigger._clearMenuConnection();
  }

  focusFirstItem() {
    this._menuItemList()?.first?.focus();
  }

  focusLastItem() {
    this._menuItemList()?.last?.focus();
  }

  focusNextItem() {
    const items = this._menuItemList()?.toArray();

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
      this.focusFirstItem();
    }
  }

  focusPreviousItem() {
    const items = this._menuItemList()?.toArray();

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
        this._trigger.unmount(false);
        break;
    }
  }
}
