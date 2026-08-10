import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Component, ElementRef, inject, input, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { EMPTY, filter, fromEvent, merge, switchMap, tap } from 'rxjs';

/**
 * A dropdown in the panel's own chrome: a trigger button and a list of projected `<button>` items.
 *
 * Deliberately a plain element rather than the app's overlay menu - the panel is adopted by a pop-up
 * window when it is popped out, and an overlay renders into the host document, which is no longer the
 * document the panel is in. Everything here therefore resolves the document from the host element on
 * every open, so a menu keeps working after the panel moves.
 *
 * @internal
 */
@Component({
  selector: 'et-query-devtools-menu',
  template: `
    <button
      [class]="triggerClass()"
      [class.et-query-devtools-menu-trigger--open]="open()"
      [attr.aria-expanded]="open()"
      [attr.title]="hint()"
      (click)="toggle()"
      class="et-query-devtools-menu-trigger"
      type="button"
      aria-haspopup="true"
    >
      @if (glyph(); as icon) {
        <span class="et-query-devtools-menu-glyph" aria-hidden="true">{{ icon }}</span>
      }
      {{ label() }}
      <span class="et-query-devtools-menu-caret" aria-hidden="true">▾</span>
    </button>

    @if (open()) {
      <div #list [attr.data-align]="align()" class="et-query-devtools-menu-list">
        <ng-content />
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'et-query-devtools-menu' },
})
export class QueryDevtoolsMenuComponent {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public label = input.required<string>();

  /** A leading glyph, when the trigger needs to be recognisable before it is read. */
  public glyph = input<string | null>(null);

  public hint = input<string | null>(null);

  /** Which edge the list is anchored to. A trigger near the panel's trailing edge needs `'end'`. */
  public align = input<'start' | 'end'>('start');

  /** The chrome button class the trigger wears, so a menu can sit in a tab strip as well as a toolbar. */
  public triggerClass = input('et-query-devtools-btn');

  /** The open list, to tell a click that picked an item from one that only reached the trigger. */
  private listEl = viewChild<ElementRef<HTMLElement>>('list');

  protected open = signal(false);

  constructor() {
    toObservable(this.open)
      .pipe(
        switchMap((isOpen) => {
          if (!isOpen) return EMPTY;

          const host = this.elementRef.nativeElement;
          const menuDoc = host.ownerDocument;

          return merge(
            // Pointer*down*, not click: a click outside would land after the trigger's own click has
            // already re-opened the menu it just closed.
            fromEvent<PointerEvent>(menuDoc, 'pointerdown', { capture: true }).pipe(
              filter((e) => !host.contains(e.target as Node)),
            ),
            fromEvent<KeyboardEvent>(menuDoc, 'keydown').pipe(filter((e) => e.key === 'Escape')),
            // Picking an item dismisses the menu, so every projected item does not have to say so itself.
            fromEvent<MouseEvent>(host, 'click').pipe(
              filter((e) => !!this.listEl()?.nativeElement.contains(e.target as Node)),
            ),
          );
        }),
        tap(() => this.open.set(false)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected toggle() {
    this.open.update((v) => !v);
  }
}
