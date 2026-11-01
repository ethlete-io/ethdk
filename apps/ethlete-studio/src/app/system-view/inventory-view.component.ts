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
import { EMPTY, Observable, catchError, finalize, map, of, startWith, switchMap, tap } from 'rxjs';
import { Inventory, InventoryFrame, approveInventory$, inventory$ } from '../../host/design-inventory';
import {
  InventoryPageComponent,
  InventoryPageEntry,
  InventoryPageFrame,
} from '../design-parts/inventory-page/inventory-page.component';
import {
  INVENTORY_APPROVER,
  approvalLabelOf,
  canApprove,
  frameLabelOf,
  inventoryControlsOf,
  refusalMessageOf,
} from './inventory';
import { PageShell, PageShellAction } from './page-shell';

type Reading = { inventory: Inventory | null; error: string | null; loading: boolean };

type ShotSize = { width: number; height: number };

const LOADING: Reading = { inventory: null, error: null, loading: true };

@Component({
  selector: 'ethlete-inventory-view',
  template: `
    <ethlete-inventory-page
      [inventory]="reading().loading ? 'loading' : 'open'"
      [tree]="shell().tree"
      [shell]="shell()"
      [part]="part()"
      [approval]="approval()"
      [approvable]="approvable()"
      [entries]="entries()"
      [frames]="frames()"
      [shotTemplate]="shot"
      (reload)="reload()"
      (approve)="approve()"
      (inventoryToggle)="inventoryToggle.emit()"
      (expandedChange)="expandedChange.emit($event)"
      (pick)="shellAction.emit({ kind: 'pick', key: $event })"
      (shellAction)="shellAction.emit($event)"
      class="h-full!"
    />

    <ng-template #shot let-frame>
      <img [src]="shotUrl(frame.key)" (load)="measure(frame.key, $event)" class="block max-w-full" alt="" />
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [InventoryPageComponent],
  host: { class: 'block size-full' },
})
export class InventoryViewComponent {
  private destroyRef = inject(DestroyRef);
  public port = input.required<number>();
  public product = input.required<string>();
  public part = input.required<string>();
  public shell = input.required<PageShell>();
  public inventoryToggle = output();
  public expandedChange = output<readonly string[]>();
  public shellAction = output<PageShellAction>();

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

  private inventory = linkedSignal(() => this.reading().inventory);

  private approveError = linkedSignal<Reading, string | null>({ source: this.reading, computation: () => null });

  private busy = signal(false);

  private sizes = signal<Record<string, ShotSize>>({});

  protected approval = computed(() => {
    const inventory = this.inventory();
    const error = this.approveError() ?? this.reading().error;

    return error ?? (inventory ? approvalLabelOf(inventory) : null);
  });

  protected approvable = computed(() => {
    const inventory = this.inventory();

    return !this.busy() && inventory !== null && canApprove(inventory);
  });

  protected entries = computed<InventoryPageEntry[]>(() => {
    const inventory = this.inventory();

    return inventory
      ? inventoryControlsOf(inventory).map((control) => ({
          number: control.number,
          id: control.id,
          ...(control.label ? { label: control.label } : {}),
          status: control.status,
          ...(control.owner ? { owner: control.owner } : {}),
          kind: control.kind,
          states: control.states,
        }))
      : [];
  });

  protected frames = computed<InventoryPageFrame[]>(() =>
    (this.inventory()?.frames ?? []).map((frame) => this.frameOf(frame)),
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
    const inventory = this.inventory();

    if (!inventory || this.busy() || !canApprove(inventory)) return;

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

  private frameOf(frame: InventoryFrame): InventoryPageFrame {
    const size = this.sizes()[frame.shot];

    return {
      key: frame.shot,
      label: frameLabelOf(frame),
      width: size?.width ?? 1,
      height: size?.height ?? 1,
      marks: size
        ? frame.controls.flatMap((control) =>
            control.box && !control.covered
              ? [{ number: control.number, status: control.status, box: control.box }]
              : [],
          )
        : [],
    };
  }
}
