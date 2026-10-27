import { Component, DestroyRef, ViewEncapsulation, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ProvideColorDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { catchError, finalize, map, of, switchMap } from 'rxjs';
import { ListedCall, ListedProduct, listedCalls$, listedSystem$, transferCall$ } from '../../host/design';
import { DesignCanvasComponent } from '../components/design-canvas/design-canvas.component';
import { callFramesOf, callKeyOf, framesOf, partKeyOf, treeOf } from './system-tree';

type Reading = { products: ListedProduct[]; error: string | null };

@Component({
  selector: 'ethlete-system-view',
  template: `
    <aside class="studio__system-tree" etProvideSurface="dark-elevated">
      @if (products().length > 1) {
        <select
          [value]="product()?.name ?? ''"
          (change)="pickProduct($event)"
          class="studio__system-product"
          title="The product the system shows"
        >
          @for (listed of products(); track listed.name) {
            <option [value]="listed.name">{{ listed.name }}</option>
          }
        </select>
      } @else if (product(); as only) {
        <h1 class="studio__system-title">{{ only.name }}</h1>
      }

      @for (group of tree(); track group.key) {
        <section class="studio__system-group">
          <header class="studio__system-group-head">{{ group.label }}</header>

          @for (entry of group.entries; track entry.key) {
            <button
              [class.studio__system-entry--active]="entry.key === selectedKey()"
              [title]="entry.title ?? ''"
              (click)="picked.set(entry.key)"
              class="studio__system-entry"
              type="button"
            >
              <span class="studio__system-entry-name">{{ entry.name }}</span>
              @for (badge of entry.badges; track badge) {
                @if (badge === 'error') {
                  <span class="studio__system-badge studio__system-badge--error" etProvideColor="danger">error</span>
                } @else {
                  <span class="studio__system-badge">{{ badge }}</span>
                }
              }
            </button>
          }
        </section>
      }
    </aside>

    <main class="studio__system-main">
      @if (!port()) {
        <p class="studio__system-note">Start the design server to see the design system.</p>
      } @else if (call(); as shown) {
        <div class="studio__system-call">
          <header class="studio__system-call-head">
            <div class="studio__system-call-title">
              <span class="studio__system-call-eyebrow">{{ shown.slug }}</span>
              @if ('headline' in shown) {
                <h2>{{ shown.headline }}</h2>
              }
            </div>
            @if ('transferred' in shown && shown.transferred) {
              <span class="studio__system-badge">transferred</span>
            } @else if (!('error' in shown)) {
              <button
                [disabled]="transferring()"
                (click)="markTransferred(shown.slug)"
                class="studio__system-button"
                type="button"
              >
                Mark transferred
              </button>
            }
            @if (transferError(); as message) {
              <span class="studio__system-call-error" etProvideColor="danger">{{ message }}</span>
            }
          </header>
          <ethlete-design-canvas [frames]="callFrames()" class="studio__system-canvas" />
        </div>
      } @else if (reading(); as read) {
        @if (read.error) {
          <p class="studio__system-note">{{ read.error }}</p>
        } @else if (read.products.length === 0) {
          <div class="studio__system-empty">
            <h2>No product yet</h2>
            <p>
              Name a product under <code>products</code> in <code>.ethlete/design/config.json</code>, with its presets,
              for example:
            </p>
            <pre>{{ EXAMPLE_CONFIG }}</pre>
            <p>Its parts live in <code>.ethlete/design/&lt;product&gt;/&lt;layer&gt;/&lt;name&gt;</code>.</p>
          </div>
        } @else if (part()) {
          <ethlete-design-canvas [frames]="frames()" class="studio__system-canvas" />
        } @else {
          <p class="studio__system-note">This product has no parts yet.</p>
        }
      }
    </main>
  `,
  styleUrl: './system-view.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [DesignCanvasComponent, ProvideColorDirective, ProvideSurfaceDirective],
  host: { class: 'studio__system' },
})
export class SystemViewComponent {
  private destroyRef = inject(DestroyRef);
  public port = input<number | null>(null);
  public epoch = input(0);
  public surface = input<string>();
  public color = input<string>();

  public tick = input(0);

  protected readonly EXAMPLE_CONFIG = JSON.stringify(
    { products: { web: { presets: { phone: { width: 390, height: 844 }, desktop: { width: 1280 } } } } },
    null,
    2,
  );

  protected reading = toSignal(
    toObservable(computed(() => ({ port: this.port(), epoch: this.epoch(), tick: this.tick() }))).pipe(
      switchMap(({ port }) =>
        port
          ? listedSystem$(port).pipe(
              map((products): Reading => ({ products, error: null })),
              catchError((error: unknown) =>
                of<Reading>({ products: [], error: error instanceof Error ? error.message : String(error) }),
              ),
            )
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected products = computed(() => this.reading()?.products ?? []);

  private callReloads = signal(0);

  public calls = toSignal(
    toObservable(
      computed(() => ({ port: this.port(), epoch: this.epoch(), tick: this.tick(), reloads: this.callReloads() })),
    ).pipe(switchMap(({ port }) => (port ? listedCalls$(port).pipe(catchError(() => of<ListedCall[]>([]))) : of([])))),
    { initialValue: [] },
  );

  private pickedProduct = signal<string | null>(null);

  protected picked = signal<string | null>(null);

  protected transferring = signal(false);

  protected transferError = signal('');

  protected product = computed(() => {
    const products = this.products();

    return products.find((listed) => listed.name === this.pickedProduct()) ?? products[0] ?? null;
  });

  protected tree = computed(() => treeOf(this.product()?.parts ?? [], this.calls()));

  protected call = computed(() => this.calls().find((listed) => callKeyOf(listed.slug) === this.picked()) ?? null);

  protected part = computed(() => {
    const parts = this.product()?.parts ?? [];
    const first = treeOf(parts)[0]?.entries[0]?.key;
    const listed =
      parts.find((candidate) => partKeyOf(candidate) === this.picked()) ??
      parts.find((candidate) => partKeyOf(candidate) === first);

    return listed ? { key: partKeyOf(listed), listed } : null;
  });

  protected selectedKey = computed(() => {
    const call = this.call();

    return call ? callKeyOf(call.slug) : (this.part()?.key ?? null);
  });

  /** The design project whose themes the shown frames wear: the open call's project, else the product. */
  public shownProject = computed(() => this.call()?.project ?? this.product()?.name ?? '');

  protected callFrames = computed(() => {
    const port = this.port();
    const call = this.call();

    if (!port || !call) return [];

    return callFramesOf({
      port,
      call,
      epoch: this.epoch(),
      revision: this.tick(),
      surface: this.surface(),
      color: this.color(),
    });
  });

  protected frames = computed(() => {
    const port = this.port();
    const product = this.product();
    const part = this.part();

    if (!port || !product || !part) return [];

    return framesOf({
      port,
      product,
      part: part.listed,
      epoch: this.epoch(),
      revision: this.tick(),
      surface: this.surface(),
      color: this.color(),
    });
  });

  protected pickProduct(event: Event) {
    this.pickedProduct.set((event.target as HTMLSelectElement).value);
  }

  protected markTransferred(slug: string) {
    const port = this.port();

    if (!port || this.transferring()) return;

    this.transferring.set(true);
    this.transferError.set('');

    transferCall$(port, slug)
      .pipe(
        catchError((error: unknown) => {
          this.transferError.set(error instanceof Error ? error.message : String(error));

          return of(null);
        }),
        finalize(() => {
          this.transferring.set(false);
          this.callReloads.update((value) => value + 1);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
