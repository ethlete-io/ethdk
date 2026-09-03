import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { RuntimeError, injectStyleManager } from '@ethlete/core';
import type { MenuSearchChrome } from '../menu-chrome';
import { MENU_ERROR_CODES } from '../menu-errors';
import { MenuSearchStylesComponent } from '../menu-search-styles.component';
import { MenuSearchSpinnerComponent } from '../menu-search-spinner.component';
import { MenuScrollbarComponent } from '../menu-scrollbar.component';
import { MenuDirective } from './menu.directive';

@Directive({
  selector: 'input[etMenuSearch]',
  exportAs: 'etMenuSearch',
  host: {
    autocomplete: 'off',
    '[attr.aria-invalid]': "error() ? 'true' : null",
    '[attr.aria-describedby]': 'error() ? errorElementId() : null',
    '(input)': 'handleInput()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class MenuSearchDirective {
  private menu = inject(MenuDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);
  private styleManager = injectStyleManager();

  public query = model('');

  public loading = input(false, { transform: booleanAttribute });

  public error = input<string | null>(null);

  /** @internal Id of the element rendering the error message, set by the component displaying it. */
  public errorElementId = signal<string | null>(null);

  constructor() {
    this.styleManager.mount(MenuSearchStylesComponent);

    this.menu?.registeredSearch.set(this);

    this.destroyRef.onDestroy(() => {
      this.menu?.unregisterSearch(this);
    });

    effect(() => {
      const query = this.query();
      const element = this.elementRef.nativeElement;

      if (element.value !== query) {
        element.value = query;
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.menu) {
          throw new RuntimeError(
            MENU_ERROR_CODES.SEARCH_OUTSIDE_MENU,
            '[MenuSearchDirective] etMenuSearch must be rendered inside the surface of an [etMenu] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  /** @internal */
  public isFocused() {
    const element = this.elementRef.nativeElement;

    return element.ownerDocument.activeElement === element;
  }

  /** @internal */
  public focus(options?: { select?: boolean }) {
    const element = this.elementRef.nativeElement;

    element.focus({ preventScroll: true });

    if (options?.select) {
      element.select();
    }
  }

  /** @internal Focuses the input and appends a character typed while an item had focus. */
  public appendCharacter(character: string) {
    const element = this.elementRef.nativeElement;

    this.focus();
    element.value += character;
    this.query.set(element.value);
  }

  public clear() {
    const element = this.elementRef.nativeElement;

    element.value = '';
    this.query.set('');
  }

  /** @internal */
  public getChrome(): MenuSearchChrome {
    return {
      scrollbar: MenuScrollbarComponent,
      spinner: MenuSearchSpinnerComponent,
    };
  }

  protected handleInput() {
    this.query.set(this.elementRef.nativeElement.value);
  }

  protected handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.elementRef.nativeElement.value) {
      event.preventDefault();
      event.stopPropagation();
      this.clear();

      return;
    }

    // everything else (printable keys, Home/End, ArrowLeft/Right) is native input editing
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Escape' || event.key === 'Tab') {
      this.menu?.handleKeydown(event);
    }
  }
}
