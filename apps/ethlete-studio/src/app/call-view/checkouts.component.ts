import { Component, DestroyRef, ViewEncapsulation, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';
import { ProvideColorDirective, ProvideSurfaceDirective } from '@ethlete/core';
import {
  DesignRoots,
  designRoots$,
  designRootsAdd$,
  designRootsForget$,
  designRootsSearch$,
  designScan$,
} from '../../host/design';
import { workspaceRoot$ } from '../../host/workspace';

const NONE: DesignRoots = { search: '', roots: [] };

/** One checkout the panel lists, and whether Studio already keeps it. */
type Row = {
  path: string;
  kept: boolean;
};

@Component({
  selector: 'ethlete-checkouts',
  template: `
    <span class="studio__checkouts">
      <select
        [value]="current()"
        [disabled]="!held().roots.length"
        [title]="current() || 'The checkout the design work lives in'"
        (change)="choose(typed($event))"
        class="studio__checkout"
      >
        @for (root of held().roots; track root) {
          <option [value]="root">{{ folderName(root) }}</option>
        } @empty {
          <option value="">No checkout</option>
        }
      </select>

      <button (click)="toggle()" class="studio__status-button" type="button" title="The checkouts Studio knows">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1V3.5h-3.8V6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1v2.6h3.8V18a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"
          />
        </svg>
      </button>

      @if (open()) {
        <div class="studio__checkouts-panel" etProvideSurface="dark-elevated">
          <div class="studio__checkouts-line">
            <span class="studio__checkouts-label">Search folder</span>
            <input
              [value]="search()"
              (input)="search.set(typed($event))"
              class="studio__checkouts-field"
              placeholder="/home/tom/dev"
            />
            <button
              [disabled]="busy() || !search().trim()"
              (click)="scan()"
              class="studio__status-button"
              type="button"
            >
              Scan
            </button>
          </div>

          <ul class="studio__checkouts-list">
            @for (row of rows(); track row.path) {
              <li [class.studio__checkouts-row--current]="row.path === current()" class="studio__checkouts-row">
                <button [title]="row.path" (click)="choose(row.path)" class="studio__checkouts-path" type="button">
                  {{ row.path }}
                </button>

                @if (row.kept) {
                  <button (click)="forget(row.path)" class="studio__status-button" type="button">Forget</button>
                } @else {
                  <button [disabled]="busy()" (click)="add(row.path)" class="studio__status-button" type="button">
                    Add
                  </button>
                }
              </li>
            } @empty {
              <li class="studio__checkouts-none">No checkout yet. Scan a folder, or name one below.</li>
            }
          </ul>

          <div class="studio__checkouts-line">
            <span class="studio__checkouts-label">Add by hand</span>
            <input
              [value]="hand()"
              (input)="hand.set(typed($event))"
              class="studio__checkouts-field"
              placeholder="/path/to/checkout"
            />
            <button
              [disabled]="busy() || !hand().trim()"
              (click)="add(hand())"
              class="studio__status-button"
              type="button"
            >
              Add
            </button>
          </div>

          @if (trouble(); as message) {
            <p class="studio__checkouts-trouble" etProvideColor="danger">{{ message }}</p>
          }
        </div>
      }
    </span>
  `,
  styleUrl: './checkouts.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective, ProvideSurfaceDirective],
})
export class CheckoutsComponent {
  private destroyRef = inject(DestroyRef);

  /** The checkout the window showed last. It wins over the first kept one when Studio still keeps it. */
  public remembered = input('');

  public pick = output<string>();

  protected held = signal<DesignRoots>(NONE);
  protected current = signal('');
  public found = signal<string[]>([]);
  protected search = signal('');
  protected hand = signal('');
  protected open = signal(false);
  protected busy = signal(false);
  protected trouble = signal('');

  protected rows = computed<Row[]>(() => {
    const kept = this.held().roots;

    return [
      ...kept.map((path) => ({ path, kept: true })),
      ...this.found()
        .filter((path) => !kept.includes(path))
        .map((path) => ({ path, kept: false })),
    ];
  });

  constructor() {
    designRoots$()
      .pipe(
        catchError(() => of(NONE)),
        switchMap((held) => (held.roots.length ? of(held) : this.keepTheHostCheckout())),
        tap((held) => this.settle(held)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected folderName(path: string) {
    return path.split('/').filter(Boolean).pop() ?? path;
  }

  protected typed(event: Event) {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected toggle() {
    this.open.update((open) => !open);
    this.trouble.set('');
  }

  protected choose(checkout: string) {
    if (!checkout || checkout === this.current()) return;

    this.current.set(checkout);
    this.pick.emit(checkout);
  }

  protected scan() {
    const folder = this.search().trim();

    this.act(
      designRootsSearch$(folder).pipe(
        tap((held) => this.held.set(held)),
        switchMap(() => designScan$(folder)),
        tap((found) => this.found.set(found)),
      ),
    );
  }

  protected add(checkout: string) {
    this.act(
      designRootsAdd$(checkout.trim()).pipe(
        tap((held) => {
          this.hand.set('');
          this.settle(held);
        }),
      ),
    );
  }

  protected forget(checkout: string) {
    this.act(designRootsForget$(checkout).pipe(tap((held) => this.settle(held))));
  }

  /**
   * A Studio nobody ever pointed anywhere opens the checkout it runs in, which is how it behaved
   * before it knew any other one. A checkout without design work is refused, and then the panel
   * is the only way in.
   */
  private keepTheHostCheckout() {
    return workspaceRoot$().pipe(
      switchMap((root) => (root ? designRootsAdd$(root) : of(NONE))),
      catchError(() => of(NONE)),
    );
  }

  private settle(held: DesignRoots) {
    this.held.set(held);
    this.search.set(this.search() || held.search);

    const current = this.current();

    if (held.roots.includes(current)) return;

    const remembered = this.remembered();

    this.choose(held.roots.includes(remembered) ? remembered : (held.roots[0] ?? ''));
  }

  private act<T>(work: Observable<T>) {
    this.busy.set(true);
    this.trouble.set('');

    work
      .pipe(
        catchError((error: unknown) => {
          this.trouble.set(String(error));

          return of(null);
        }),
        tap(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
