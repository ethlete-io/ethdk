import { Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ProvideColorDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { catchError, map, of, switchMap } from 'rxjs';
import { ListedProduct, listedSystem$ } from '../../host/design';
import { DesignCanvasComponent } from '../components/design-canvas/design-canvas.component';
import { framesOf, partKeyOf, treeOf } from './system-tree';

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
              [class.studio__system-entry--active]="entry.key === part()?.key"
              (click)="pickedPart.set(entry.key)"
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

  private pickedProduct = signal<string | null>(null);

  protected pickedPart = signal<string | null>(null);

  protected product = computed(() => {
    const products = this.products();

    return products.find((listed) => listed.name === this.pickedProduct()) ?? products[0] ?? null;
  });

  protected tree = computed(() => treeOf(this.product()?.parts ?? []));

  protected part = computed(() => {
    const parts = this.tree().flatMap((group) => group.entries);
    const key = (parts.find((entry) => entry.key === this.pickedPart()) ?? parts[0])?.key;
    const listed = this.product()?.parts.find((candidate) => partKeyOf(candidate) === key);

    return listed ? { key, listed } : null;
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
}
