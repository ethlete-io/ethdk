import { Component, DestroyRef, ViewEncapsulation, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';
import { BUTTON_IMPORTS, INPUT_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';
import { ProvideColorDirective, ProvideSurfaceDirective, injectSemanticColorTheme } from '@ethlete/core';
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

const LABEL = 'w-22.5 shrink-0 text-[1.1rem] text-text-muted';

/** One checkout the panel lists, and whether Studio already keeps it. */
type Row = {
  path: string;
  kept: boolean;
};

@Component({
  selector: 'ethlete-checkouts',
  template: `
    <span class="relative flex min-w-0 flex-[0_1_44rem] items-center gap-1.5">
      <et-select
        [disabled]="!held().roots.length"
        [value]="current()"
        [title]="current() || 'The checkout the design work lives in'"
        (valueChange)="choose($event)"
        class="min-w-30 flex-[0_1_44rem] font-mono text-[1.1rem]"
        aria-label="Checkout"
        placeholder="No checkout"
      >
        @for (root of held().roots; track root) {
          <et-select-option [value]="root">{{ folderName(root) }}</et-select-option>
        }
      </et-select>

      <button
        (click)="toggle()"
        et-button
        type="button"
        variant="transparent"
        color="surface"
        size="xs"
        title="The checkouts Studio knows"
        aria-label="Checkouts"
      >
        <svg class="size-3 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1V3.5h-3.8V6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1v2.6h3.8V18a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"
          />
        </svg>
      </button>

      @if (open()) {
        <div
          class="absolute bottom-[calc(100%+0.8rem)] left-0 z-2 flex w-130 max-w-[90vw] flex-col gap-2 rounded-md border border-surface-border bg-surface-raised p-3 shadow-[0_1.2rem_3.2rem_rgb(var(--et-shadow-color-rgb,0_0_0)/45%)]"
          etProvideSurface="dark-elevated"
        >
          <div class="flex items-center gap-2">
            <span [class]="LABEL">Search folder</span>
            <et-input
              [(value)]="search"
              class="min-w-0 flex-1 font-mono text-[1.1rem]"
              placeholder="/home/tom/dev"
              aria-label="Search folder"
            />
            <button
              [disabled]="busy() || !search().trim()"
              (click)="scan()"
              et-button
              type="button"
              variant="outline"
              color="surface"
              size="xs"
            >
              Scan
            </button>
          </div>

          <ul class="m-0 flex max-h-60 list-none flex-col gap-0.5 overflow-auto p-0">
            @for (row of rows(); track row.path) {
              <li
                [style.background]="
                  row.path === current() ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : null
                "
                class="group flex items-center gap-2 rounded-sm px-1 py-0.5 hover:bg-[color-mix(in_srgb,var(--et-surface-interaction-solid)_8%,transparent)]"
              >
                <button
                  [title]="row.path"
                  (click)="choose(row.path)"
                  class="min-w-0 flex-1 cursor-pointer overflow-hidden border-0 bg-transparent p-0 text-left font-mono text-[1.1rem] text-ellipsis whitespace-nowrap text-[var(--et-surface-color-subtle-solid)] group-hover:text-text"
                  type="button"
                >
                  {{ row.path }}
                </button>

                @if (row.kept) {
                  <button
                    (click)="forget(row.path)"
                    et-button
                    type="button"
                    variant="transparent"
                    color="surface"
                    size="xs"
                  >
                    Forget
                  </button>
                } @else {
                  <button
                    [disabled]="busy()"
                    (click)="add(row.path)"
                    et-button
                    type="button"
                    variant="outline"
                    color="surface"
                    size="xs"
                  >
                    Add
                  </button>
                }
              </li>
            } @empty {
              <li class="p-1 text-[1.1rem] text-text-muted">No checkout yet. Scan a folder, or name one below.</li>
            }
          </ul>

          <div class="flex items-center gap-2">
            <span [class]="LABEL">Add by hand</span>
            <et-input
              [(value)]="hand"
              class="min-w-0 flex-1 font-mono text-[1.1rem]"
              placeholder="/path/to/checkout"
              aria-label="Checkout path"
            />
            <button
              [disabled]="busy() || !hand().trim()"
              (click)="add(hand())"
              et-button
              type="button"
              variant="outline"
              color="surface"
              size="xs"
            >
              Add
            </button>
          </div>

          @if (trouble(); as message) {
            <p [etProvideColor]="errorTheme()" class="m-0 text-[1.1rem] text-[var(--et-theme-color-ink-solid)]">
              {{ message }}
            </p>
          }
        </div>
      }
    </span>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, INPUT_IMPORTS, SELECT_IMPORTS, ProvideColorDirective, ProvideSurfaceDirective],
})
export class CheckoutsComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  private destroyRef = inject(DestroyRef);

  /** The checkout the window showed last. It wins over the first kept one when Studio still keeps it. */
  public remembered = input('');

  public pick = output<string>();

  protected readonly LABEL = LABEL;

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
    return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
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
