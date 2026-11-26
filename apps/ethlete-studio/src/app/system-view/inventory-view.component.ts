import { Component, ViewEncapsulation, computed, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, from, map, mergeMap, of, scan, startWith, switchMap } from 'rxjs';
import { ShotStateComponent, ShotStateDirective } from '../components/design-canvas/partials/shot-state';
import { Inventory, inventory$ } from '../../host/design-inventory';
import { InventoryPageComponent, InventoryPageEntry } from '../design-parts/inventory-page/inventory-page.component';
import { inventoryPageOf, refusalMessageOf } from './inventory';
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
      [shotTemplate]="shot"
      (reload)="reload()"
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

  private sizes = signal<Record<string, ShotSize>>({});

  protected loading = computed(() => this.pages().length > 0 && Object.keys(this.readings()).length === 0);

  protected entries = computed<InventoryPageEntry[]>(() =>
    this.pages().flatMap((part) => {
      const reading = this.readings()[part];

      if (!reading) return [];

      const { inventory, error } = reading;

      if (!inventory)
        return [
          {
            part,
            error,
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
}
