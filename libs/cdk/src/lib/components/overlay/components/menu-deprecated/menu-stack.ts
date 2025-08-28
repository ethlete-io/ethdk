import { Inject, Injectable, InjectionToken, Optional, SkipSelf } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs/operators';

export const enum FocusNext {
  nextItem,
  previousItem,
  currentItem,
}

export interface MenuStackItem {
  menuStack?: MenuStack;
}

export const MENU_STACK = new InjectionToken<MenuStack>('cdk-menu-stack');

export const PARENT_OR_NEW_MENU_STACK_PROVIDER = {
  provide: MENU_STACK,
  deps: [[new Optional(), new SkipSelf(), new Inject(MENU_STACK)]],
  useFactory: (parentMenuStack?: MenuStack) => parentMenuStack || new MenuStack(),
};

export const PARENT_OR_NEW_INLINE_MENU_STACK_PROVIDER = (orientation: 'vertical' | 'horizontal') => ({
  provide: MENU_STACK,
  deps: [[new Optional(), new SkipSelf(), new Inject(MENU_STACK)]],
  useFactory: (parentMenuStack?: MenuStack) => parentMenuStack || MenuStack.inline(orientation),
});

export interface CloseOptions {
  focusNextOnEmpty?: FocusNext;
  focusParentTrigger?: boolean;
}

export interface MenuStackCloseEvent {
  item: MenuStackItem;
  focusParentTrigger?: boolean;
}

let nextId = 0;

/**
 * @deprecated Use the new menu instead
 */
@Injectable()
export class MenuStack {
  readonly id = `${nextId++}`;

  private readonly _elements: MenuStackItem[] = [];

  private readonly _close = new Subject<MenuStackCloseEvent>();

  private readonly _empty = new Subject<FocusNext | undefined>();

  private readonly _hasFocus = new Subject<boolean>();

  readonly closed: Observable<MenuStackCloseEvent> = this._close;

  readonly hasFocus: Observable<boolean> = this._hasFocus.pipe(
    startWith(false),
    debounceTime(0),
    distinctUntilChanged(),
  );

  readonly emptied: Observable<FocusNext | undefined> = this._empty;

  private _inlineMenuOrientation: 'vertical' | 'horizontal' | null = null;

  static inline(orientation: 'vertical' | 'horizontal') {
    const stack = new MenuStack();
    stack._inlineMenuOrientation = orientation;
    return stack;
  }

  push(menu: MenuStackItem) {
    this._elements.push(menu);
  }

  close(lastItem: MenuStackItem, options?: CloseOptions) {
    const { focusNextOnEmpty, focusParentTrigger } = { ...options };
    if (this._elements.indexOf(lastItem) >= 0) {
      let poppedElement;
      do {
        poppedElement = this._elements.pop()!;
        this._close.next({ item: poppedElement, focusParentTrigger });
      } while (poppedElement !== lastItem);

      if (this.isEmpty()) {
        this._empty.next(focusNextOnEmpty);
      }
    }
  }

  closeSubMenuOf(lastItem: MenuStackItem) {
    let removed = false;
    if (this._elements.indexOf(lastItem) >= 0) {
      removed = this.peek() !== lastItem;
      while (this.peek() !== lastItem) {
        this._close.next({ item: this._elements.pop()! });
      }
    }
    return removed;
  }

  closeAll(options?: CloseOptions) {
    const { focusNextOnEmpty, focusParentTrigger } = { ...options };
    if (!this.isEmpty()) {
      while (!this.isEmpty()) {
        const menuStackItem = this._elements.pop();
        if (menuStackItem) {
          this._close.next({ item: menuStackItem, focusParentTrigger });
        }
      }
      this._empty.next(focusNextOnEmpty);
    }
  }

  isEmpty() {
    return !this._elements.length;
  }

  length() {
    return this._elements.length;
  }

  peek(): MenuStackItem | undefined {
    return this._elements[this._elements.length - 1];
  }

  hasInlineMenu() {
    return this._inlineMenuOrientation != null;
  }

  inlineMenuOrientation() {
    return this._inlineMenuOrientation;
  }

  setHasFocus(hasFocus: boolean) {
    this._hasFocus.next(hasFocus);
  }
}
