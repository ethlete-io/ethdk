import { Component, DestroyRef, ViewEncapsulation, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { ColorTheme, ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
import { EMPTY, Observable, catchError, finalize, map, of, startWith, switchMap, tap } from 'rxjs';
import { Inventory, InventoryFrame, InventoryStatus, approveInventory$, inventory$ } from '../../host/design-inventory';
import {
  INVENTORY_APPROVER,
  INVENTORY_TONES,
  approvalLabelOf,
  approveBlockOf,
  boxStyleOf,
  frameLabelOf,
  inventoryControlsOf,
  refusalMessageOf,
} from './inventory';

type Reading = { inventory: Inventory | null; error: string | null; loading: boolean };

type ShotSize = { width: number; height: number };

const LOADING: Reading = { inventory: null, error: null, loading: true };

@Component({
  selector: 'ethlete-inventory-view',
  template: `
    <header class="flex flex-wrap items-center gap-3 border-b border-(--et-surface-border-solid) px-4 py-3">
      <h2 class="m-0 text-[1.4rem] font-semibold">Inventory</h2>
      @if (inventory(); as shown) {
        <span class="text-small text-text-muted" data-inventory-approval>{{ APPROVAL_LABEL_OF(shown) }}</span>
      }
      <span class="flex-1"></span>
      <button
        [disabled]="reading().loading"
        (click)="reload()"
        et-button
        type="button"
        variant="outline"
        color="surface"
        size="sm"
        data-inventory-reload
      >
        Reload
      </button>
      <button
        [disabled]="busy() || approveBlock() !== null"
        [title]="approveBlock() ?? 'Approve the controls of this page'"
        (click)="approve()"
        et-button
        type="button"
        variant="filled"
        size="sm"
        data-inventory-approve
      >
        Approve inventory
      </button>
    </header>
    @if (error(); as message) {
      <p
        [etProvideColor]="errorTheme()"
        class="m-0 border-b border-(--et-surface-border-solid) px-4 py-2 text-small text-(--et-theme-color-primary-solid)"
        data-inventory-error
      >
        {{ message }}
      </p>
    }
    @if (inventory(); as shown) {
      <div class="grid min-h-0 grid-cols-[minmax(0,1fr)_32rem]">
        <div class="flex min-h-0 flex-col gap-6 overflow-auto p-4">
          @for (frame of shown.frames; track frame.shot) {
            <figure class="m-0 flex flex-col gap-2">
              <figcaption class="font-mono text-small text-text-muted">{{ FRAME_LABEL_OF(frame) }}</figcaption>
              <div class="relative self-start border border-(--et-surface-border-solid)">
                <img [src]="shotUrl(frame)" (load)="measure(frame, $event)" class="block max-w-full" alt="" />
                @if (sizes()[frame.shot]; as size) {
                  @for (control of frame.controls; track $index) {
                    @if (control.box; as box) {
                      <div
                        [etProvideColor]="themeOf(control.status)"
                        [style]="BOX_STYLE_OF(box, size)"
                        [attr.data-inventory-box]="control.number"
                        [attr.data-status]="control.status"
                        [title]="control.id"
                        class="pointer-events-none absolute border-2 border-(--et-theme-color-primary-solid)"
                      >
                        <span
                          class="absolute -top-2 -left-2 rounded-full bg-(--et-theme-color-primary-solid) px-1 font-mono text-[1rem] leading-4 text-(--et-theme-color-on-primary-solid)"
                        >
                          {{ control.number }}
                        </span>
                      </div>
                    }
                  }
                }
              </div>
            </figure>
          } @empty {
            <p class="m-0 text-small text-text-muted">This page draws no rest frame.</p>
          }
        </div>
        <ol
          class="m-0 flex min-h-0 list-none flex-col gap-2 overflow-auto border-l border-(--et-surface-border-solid) p-4"
        >
          @for (control of controls(); track control.number) {
            <li
              [etProvideColor]="themeOf(control.status)"
              [attr.data-inventory-entry]="control.number"
              [attr.data-status]="control.status"
              class="flex gap-2 text-small"
            >
              <span
                class="h-fit shrink-0 rounded-full bg-(--et-theme-color-primary-solid) px-1.5 font-mono text-(--et-theme-color-on-primary-solid)"
              >
                {{ control.number }}
              </span>
              <span class="flex min-w-0 flex-col">
                <span class="font-mono break-all text-text">{{ control.id }}</span>
                <span class="text-text-muted">
                  {{ control.status }} · {{ control.kind }} · {{ control.states }}
                  {{ control.states === 1 ? 'state' : 'states' }}
                </span>
                @if (control.inputs.length) {
                  <span class="text-text-muted">inputs: {{ control.inputs.join(', ') }}</span>
                }
                @if (control.surfaces.length) {
                  <span class="text-text-muted">surfaces: {{ control.surfaces.join(', ') }}</span>
                }
              </span>
            </li>
          } @empty {
            <li class="text-small text-text-muted">No controls.</li>
          }
        </ol>
      </div>
    } @else if (reading().loading) {
      <p class="m-0 p-4 text-small text-text-muted">Drawing the inventory…</p>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ProvideColorDirective],
  host: { class: 'grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] bg-(--et-surface-background-solid)' },
})
export class InventoryViewComponent {
  private destroyRef = inject(DestroyRef);
  protected errorTheme = injectSemanticColorTheme('error');
  private warningTheme = injectSemanticColorTheme('warning');
  public port = input.required<number>();
  public product = input.required<string>();
  public part = input.required<string>();
  protected readonly APPROVAL_LABEL_OF = approvalLabelOf;
  protected readonly FRAME_LABEL_OF = frameLabelOf;
  protected readonly BOX_STYLE_OF = boxStyleOf;

  private reloads = signal(0);

  protected reading = toSignal(
    toObservable(
      computed(() => ({ port: this.port(), product: this.product(), part: this.part(), reloads: this.reloads() })),
    ).pipe(
      switchMap((address): Observable<Reading> =>
        inventory$(address).pipe(
          map((inventory) => ({ inventory, error: null, loading: false })),
          catchError((error: unknown) => of({ inventory: null, error: refusalMessageOf(error), loading: false })),
          startWith(LOADING),
        ),
      ),
    ),
    { initialValue: LOADING },
  );

  protected inventory = linkedSignal(() => this.reading().inventory);

  private approveError = linkedSignal<Reading, string | null>({ source: this.reading, computation: () => null });

  protected error = computed(() => this.approveError() ?? this.reading().error);

  protected controls = computed(() => {
    const inventory = this.inventory();

    return inventory ? inventoryControlsOf(inventory) : [];
  });

  protected approveBlock = computed(() => {
    const inventory = this.inventory();

    return inventory ? approveBlockOf(inventory) : 'no inventory';
  });

  protected busy = signal(false);

  protected sizes = signal<Record<string, ShotSize>>({});

  protected themeOf(status: InventoryStatus): ColorTheme | undefined {
    const tone = INVENTORY_TONES[status];

    if (tone === 'error') return this.errorTheme();
    if (tone === 'warning') return this.warningTheme();

    return undefined;
  }

  protected shotUrl(frame: InventoryFrame) {
    return `http://localhost:${this.port()}${frame.shot}`;
  }

  protected measure(frame: InventoryFrame, event: Event) {
    const image = event.target as HTMLImageElement;

    if (!image.naturalWidth || !image.naturalHeight) return;

    this.sizes.update((sizes) => ({
      ...sizes,
      [frame.shot]: { width: image.naturalWidth, height: image.naturalHeight },
    }));
  }

  protected reload() {
    this.reloads.update((count) => count + 1);
  }

  protected approve() {
    const inventory = this.inventory();

    if (!inventory || this.busy() || approveBlockOf(inventory) !== null) return;

    this.busy.set(true);
    this.approveError.set(null);
    approveInventory$(
      { port: this.port(), product: this.product() },
      { part: inventory.part, hash: inventory.hash, by: INVENTORY_APPROVER },
    )
      .pipe(
        tap((approved) => this.inventory.set(approved)),
        catchError((error: unknown) => {
          this.approveError.set(refusalMessageOf(error));

          return EMPTY;
        }),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
