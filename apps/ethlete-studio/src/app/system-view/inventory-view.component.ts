import {
  Component,
  DestroyRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  catchError,
  finalize,
  from,
  map,
  mergeMap,
  of,
  scan,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { ShotStateComponent, ShotStateDirective } from '../components/design-canvas/partials/shot-state';
import { Inventory, approveInventory$, inventory$ } from '../../host/design-inventory';
import { InventoryPageComponent, InventoryPageEntry } from '../design-parts/inventory-page/inventory-page.component';
import { INVENTORY_APPROVER, approvalLabelOf, canApprove, inventoryPageOf, refusalMessageOf } from './inventory';
import { PageShell, PageShellAction } from './page-shell';

type PageReading = { inventory: Inventory | null; error: string | null };

type ShotSize = { width: number; height: number };

const CONCURRENT_READS = 3;

@Component({
  selector: 'ethlete-inventory-view',
  template: `
    <ethlete-inventory-page
      [inventory]="loading() ? 'loading' : 'open'"
      [tree]="shell().tree"
      [shell]="shell()"
      [pages]="entries()"
      [selected]="selected()"
      [approving]="busy()"
      [shotTemplate]="shot"
      (reload)="reload()"
      (approve)="approve()"
      (expandedChange)="expandedChange.emit($event)"
      (pick)="shellAction.emit({ kind: 'pick', key: $event })"
      (shellAction)="shellAction.emit($event)"
      class="h-full!"
    />

    <ng-template #shot let-page>
      <img
        #shotState="ethleteShot"
        [src]="shotUrl(page.shot)"
        (load)="measure(page.shot, $event)"
        class="block size-full"
        ethleteShot
        alt=""
      />
      <ethlete-shot-state [state]="shotState.state()" />
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [InventoryPageComponent, ShotStateDirective, ShotStateComponent],
  host: { class: 'block size-full' },
})
export class InventoryViewComponent {
  private destroyRef = inject(DestroyRef);
  public port = input.required<number>();
  public product = input.required<string>();
  public pages = input.required<readonly string[]>();
  public selected = input<string | null>(null);
  public shell = input.required<PageShell>();
  public expandedChange = output<readonly string[]>();
  public shellAction = output<PageShellAction>();

  private reloads = signal(0);

  private readings = toSignal(
    toObservable(
      computed(() => ({ port: this.port(), product: this.product(), pages: this.pages(), reloads: this.reloads() })),
    ).pipe(
      switchMap(({ port, product, pages }) =>
        from(pages).pipe(
          mergeMap(
            (part): Observable<[string, PageReading]> =>
              inventory$({ port, product, part }).pipe(
                map((inventory): [string, PageReading] => [part, { inventory, error: null }]),
                catchError((error: unknown) =>
                  of<[string, PageReading]>([part, { inventory: null, error: refusalMessageOf(error) }]),
                ),
              ),
            CONCURRENT_READS,
          ),
          scan((readings, [part, reading]) => ({ ...readings, [part]: reading }), {} as Record<string, PageReading>),
          startWith({} as Record<string, PageReading>),
        ),
      ),
    ),
    { initialValue: {} as Record<string, PageReading> },
  );

  private approved = linkedSignal<Record<string, PageReading>, Record<string, Inventory>>({
    source: this.readings,
    computation: () => ({}),
  });

  private approveErrors = linkedSignal<Record<string, PageReading>, Record<string, string>>({
    source: this.readings,
    computation: () => ({}),
  });

  protected busy = signal(false);

  private sizes = signal<Record<string, ShotSize>>({});

  protected loading = computed(() => this.pages().length > 0 && Object.keys(this.readings()).length === 0);

  private shownPart = computed(() => {
    const pages = this.pages();
    const selected = this.selected();

    return selected !== null && pages.includes(selected) ? selected : (pages[0] ?? null);
  });

  protected entries = computed<InventoryPageEntry[]>(() =>
    this.pages().flatMap((part) => {
      const reading = this.readings()[part];

      if (!reading) return [];

      const inventory = this.approved()[part] ?? reading.inventory;
      const error = this.approveErrors()[part] ?? reading.error;

      if (!inventory)
        return [
          {
            part,
            approval: 'open' as const,
            approvalLabel: error ?? '',
            controls: [],
            assets: [],
            overlays: [],
            shot: null,
            size: null,
          },
        ];

      const shot = inventory.frames[0]?.shot;

      return [
        inventoryPageOf(inventory, {
          approvalLabel: error ?? approvalLabelOf(inventory),
          size: (shot && this.sizes()[shot]) || null,
        }),
      ];
    }),
  );

  protected shotUrl(shot: string) {
    return `http://localhost:${this.port()}${shot}`;
  }

  protected measure(shot: string, event: Event) {
    const image = event.target as HTMLImageElement;

    if (!image.naturalWidth || !image.naturalHeight) return;

    this.sizes.update((sizes) => ({ ...sizes, [shot]: { width: image.naturalWidth, height: image.naturalHeight } }));
  }

  protected reload() {
    this.reloads.update((count) => count + 1);
  }

  protected approve() {
    const part = this.shownPart();
    const inventory = part === null ? null : (this.approved()[part] ?? this.readings()[part]?.inventory ?? null);

    if (!inventory || this.busy() || !canApprove(inventory)) return;

    this.busy.set(true);
    this.approveErrors.update(({ [inventory.part]: _dropped, ...rest }) => rest);
    approveInventory$(
      { port: this.port(), product: this.product() },
      { part: inventory.part, hash: inventory.hash, by: INVENTORY_APPROVER },
    )
      .pipe(
        tap((approved) => this.approved.update((all) => ({ ...all, [approved.part]: approved }))),
        catchError((error: unknown) => {
          this.approveErrors.update((all) => ({ ...all, [inventory.part]: refusalMessageOf(error) }));

          return EMPTY;
        }),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
