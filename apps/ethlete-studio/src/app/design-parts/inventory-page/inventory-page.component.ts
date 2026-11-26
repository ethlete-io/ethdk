import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { CanvasViewport, mountCanvasViewport } from '../../components/design-canvas/canvas-viewport';
import { INVENTORY_LABELS } from '../../i18n/inventory-labels';
import { CanvasViewportComponent } from '../canvas-viewport/canvas-viewport.component';
import { PartTreeComponent } from '../part-tree/part-tree.component';
import { SHELL_SAMPLE, ShellAction, ShellPageComponent, ShellState } from '../shell-main/shell-page.component';
import { SketchHeadComponent } from '../sketch-head/sketch-head.component';
import { ZoomChipComponent } from '../zoom-chip/zoom-chip.component';
import { placeMarkers } from './marker-layout';
import { INVENTORY_PAGE_TREE, inventoryPageSampleOf } from './inventory-page-sample';

export type InventoryPageState = 'open' | 'loading';

export type InventoryPageTone = 'ok' | 'error' | 'warning';

export type InventoryPageBox = { x: number; y: number; width: number; height: number };

/** `box` is in the pixels of the page's `size`; a row without one draws no mark on the frame. */
export type InventoryPageRow = {
  number: string;
  name: string;
  detail: string;
  tone: InventoryPageTone;
  box: InventoryPageBox | null;
};

export type InventoryPageEntry = {
  part: string;
  controls: InventoryPageRow[];
  assets: InventoryPageRow[];
  overlays: InventoryPageRow[];
  error: string | null;
  shot: string | null;
  size: { width: number; height: number } | null;
};

const FRAME = { width: 360, height: 225 };

const COLUMNS = 2;

const ZOOM_STEP = 1.5;

const percentOf = (value: number, of: number) => String((value / of) * 100) + '%';

const rowsOf = (page: InventoryPageEntry) => [...page.controls, ...page.assets, ...page.overlays];

const openCountOf = (page: InventoryPageEntry) => rowsOf(page).filter((row) => row.tone !== 'ok').length;

@Component({
  selector: 'ethlete-inventory-page',
  template: `
    <ethlete-shell-page [shell]="shell()" (action)="shellAction.emit($event)" section="System">
      <div class="-m-space-2 h-[calc(100%+var(--space-2)*2)] overflow-y-auto p-space-2" shellMainSide>
        <ethlete-part-tree
          [layers]="tree().layers"
          [sketches]="tree().sketches"
          [legacy]="tree().legacy"
          (expandedChange)="expandedChange.emit($event)"
          (activate)="pick.emit($event)"
        />
      </div>
      <div class="grid h-full grid-cols-[minmax(0,1fr)_28rem]">
        <div class="relative min-h-0 overflow-hidden">
          @if (loading()) {
            <p
              class="m-0 p-space-4 ps-[calc(var(--st-shell-inset-left)+var(--space-4))] text-ui-sm text-et-surface-text-muted"
            >
              {{ LABELS.drawing }}
            </p>
          } @else {
            <ethlete-canvas-viewport class="absolute inset-0 overflow-hidden">
              <div #world class="absolute top-0 left-(--st-shell-inset-left) origin-top-left">
                @for (frame of frames(); track frame.page.part) {
                  <figure
                    [style.left.px]="frame.x"
                    [style.top.px]="frame.y"
                    class="absolute m-0 flex flex-col gap-space-1"
                  >
                    <figcaption class="flex items-center gap-space-2 text-ui-sm whitespace-nowrap">
                      <span [class.font-ui-strong]="frame.selected" class="text-et-surface-text">{{
                        frame.page.part
                      }}</span>
                      @if (frame.open) {
                        <span [etProvideColor]="errorTheme()" class="text-et-tone-fill">{{
                          LABELS.open(frame.open)
                        }}</span>
                      }
                    </figcaption>
                    <div
                      [class.outline-2]="frame.selected"
                      [class.outline]="!frame.selected"
                      [style.width.px]="FRAME.width"
                      [style.height.px]="FRAME.height"
                      class="relative bg-et-surface-background outline-et-surface-border"
                    >
                      @if (frame.page.shot) {
                        @if (shotTemplate(); as template) {
                          <ng-container *ngTemplateOutlet="template; context: { $implicit: frame.page }" />
                        }
                      }
                      @if (frame.page.size; as size) {
                        @for (row of frame.rows; track row.number) {
                          @if (row.box; as box) {
                            <div
                              [etProvideColor]="themeOf(row.tone)"
                              [style.left]="PERCENT_OF(box.x, size.width)"
                              [style.top]="PERCENT_OF(box.y, size.height)"
                              [style.width]="PERCENT_OF(box.width, size.width)"
                              [style.height]="PERCENT_OF(box.height, size.height)"
                              class="pointer-events-none absolute border-2 border-et-tone-fill"
                            ></div>
                          }
                        }
                        @for (marker of frame.markers; track marker.number) {
                          <span
                            [etProvideColor]="marker.theme"
                            [style.left.px]="marker.left"
                            [style.top.px]="marker.top"
                            [style.width.px]="marker.width"
                            [style.height.px]="marker.height"
                            class="pointer-events-none absolute rounded-full bg-et-tone-fill text-center font-code text-ui-xs leading-4 text-et-tone-on-fill"
                            >{{ marker.number }}</span
                          >
                        }
                      }
                    </div>
                  </figure>
                }
              </div>
            </ethlete-canvas-viewport>
            <ethlete-zoom-chip
              [percent]="percent()"
              (zoomOut)="zoomBy(1 / ZOOM_STEP)"
              (zoomIn)="zoomBy(ZOOM_STEP)"
              (zoomReset)="zoomReset()"
              (fit)="fit()"
              class="absolute right-space-3 bottom-space-3 z-3"
            />
          }
          <div
            class="pointer-events-none absolute inset-x-0 bottom-space-3 z-3 flex justify-center ps-(--st-shell-inset-left)"
          >
            <ethlete-sketch-head [status]="null" class="pointer-events-auto min-w-0" discardable="false">
              <button
                [disabled]="loading()"
                (click)="reload.emit()"
                sketchHeadExtra
                et-button
                type="button"
                variant="transparent"
                color="surface"
                size="sm"
              >
                {{ LABELS.reload }}
              </button>
            </ethlete-sketch-head>
          </div>
        </div>
        <aside class="flex min-h-0 flex-col border-l border-et-surface-border bg-et-surface-background">
          <header
            class="flex flex-wrap items-center gap-space-3 border-b border-et-surface-border px-space-4 py-space-3"
          >
            <div class="flex min-w-24 flex-1 basis-0 flex-col">
              <span class="truncate text-ui-sm text-et-surface-text-muted">{{ LABELS.title }}</span>
              <h2 class="m-0 truncate text-ui-lg font-ui-strong">{{ loading() ? '' : (current()?.part ?? '') }}</h2>
            </div>
            @if (!loading() && current()?.error; as error) {
              <p class="m-0 w-full text-ui-sm whitespace-pre-line text-et-surface-text-muted">{{ error }}</p>
            }
          </header>
          @if (!loading() && current(); as page) {
            <div class="flex min-h-0 flex-col gap-space-5 overflow-auto p-space-4">
              @for (section of sectionsOf(page); track section.title) {
                <section class="flex flex-col gap-space-2">
                  <h3 class="m-0 text-ui-sm font-ui-strong text-et-surface-text">
                    {{ section.title }}
                    <span class="font-ui text-et-surface-text-muted">{{ section.rows.length }}</span>
                  </h3>
                  @if (section.rows.length) {
                    <ol class="m-0 flex list-none flex-col gap-space-2 p-0">
                      @for (row of section.rows; track row.number) {
                        <li [etProvideColor]="themeOf(row.tone)" class="flex gap-space-2 text-ui-sm">
                          <span
                            class="h-fit shrink-0 rounded-full bg-et-tone-fill px-1.5 font-code text-et-tone-on-fill"
                            >{{ row.number }}</span
                          >
                          <span class="flex min-w-0 flex-col">
                            <span class="text-et-surface-text">{{ row.name }}</span>
                            <span [class]="row.tone === 'ok' ? 'text-et-surface-text-muted' : 'text-et-tone-fill'">{{
                              row.detail
                            }}</span>
                          </span>
                        </li>
                      }
                    </ol>
                  } @else {
                    <p class="m-0 text-ui-sm text-et-surface-text-muted">{{ LABELS.none }}</p>
                  }
                </section>
              }
            </div>
          }
        </aside>
      </div>
    </ethlete-shell-page>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    NgTemplateOutlet,
    BUTTON_IMPORTS,
    CanvasViewportComponent,
    PartTreeComponent,
    ProvideColorDirective,
    ShellPageComponent,
    SketchHeadComponent,
    ZoomChipComponent,
  ],
  host: { class: 'block h-screen w-full' },
})
export class InventoryPageComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  private successTheme = injectSemanticColorTheme('success');
  private warningTheme = injectSemanticColorTheme('warning');
  public shell = input<ShellState>(SHELL_SAMPLE);
  public inventory = input<InventoryPageState>('open');
  public tree = input(INVENTORY_PAGE_TREE);
  public pages = input<InventoryPageEntry[] | null>(null);
  public selected = input<string | null>(null);
  public shotTemplate = input<TemplateRef<{ $implicit: InventoryPageEntry }> | null>(null);
  public shellAction = output<ShellAction>();

  public reload = output();

  public pick = output<string>();
  public expandedChange = output<readonly string[]>();

  private viewport = viewChild(CanvasViewportComponent, { read: ElementRef });
  private world = viewChild<ElementRef<HTMLElement>>('world');
  private canvas = signal<CanvasViewport | null>(null);
  private mounted: HTMLElement | null = null;

  protected readonly LABELS = INVENTORY_LABELS;
  protected readonly FRAME = FRAME;
  protected readonly ZOOM_STEP = ZOOM_STEP;
  protected readonly PERCENT_OF = percentOf;
  protected loading = computed(() => this.inventory() === 'loading');
  public shown = computed(() => this.pages() ?? inventoryPageSampleOf(this.inventory()));
  protected current = computed(() => {
    const pages = this.shown();

    return pages.find((page) => page.part === this.selected()) ?? pages[0] ?? null;
  });
  protected frames = computed(() =>
    this.shown().map((page, index) => ({
      page,
      markers: this.markersOf(page),
      selected: page === this.current(),
      open: openCountOf(page),
      rows: rowsOf(page),
      x: 40 + (index % COLUMNS) * (FRAME.width + 48),
      y: 48 + Math.floor(index / COLUMNS) * (FRAME.height + 80),
    })),
  );
  protected percent = computed(() => Math.round((this.canvas()?.zoom() ?? 1) * 100));

  public constructor() {
    afterRenderEffect(() => this.mountCamera());
  }

  protected sectionsOf(page: InventoryPageEntry) {
    return [
      { title: this.LABELS.controls, rows: page.controls },
      { title: this.LABELS.assets, rows: page.assets },
      { title: this.LABELS.overlays, rows: page.overlays },
    ];
  }

  protected themeOf(tone: InventoryPageTone) {
    return tone === 'error' ? this.errorTheme() : tone === 'warning' ? this.warningTheme() : this.successTheme();
  }

  protected zoomBy(factor: number) {
    const canvas = this.canvas();

    canvas?.show({ kind: 'visible', zoom: canvas.camera().zoom * factor });
  }

  protected zoomReset() {
    this.canvas()?.show({ kind: 'visible', zoom: 1 });
  }

  protected fit() {
    this.canvas()?.show({ kind: 'all' });
  }

  private markersOf(page: InventoryPageEntry) {
    const { size } = page;

    if (!size) return [];

    const rows = rowsOf(page).filter((row) => row.box);
    const placed = placeMarkers(
      rows.map((row) => ({
        number: row.number,
        x: ((row.box?.x ?? 0) / size.width) * FRAME.width,
        y: ((row.box?.y ?? 0) / size.height) * FRAME.height,
      })),
      FRAME,
    );

    return placed.map((marker, index) => ({ ...marker, theme: this.themeOf(rows[index]?.tone ?? 'ok') }));
  }

  private mountCamera() {
    const viewport: HTMLElement | undefined = this.viewport()?.nativeElement;
    const world = this.world()?.nativeElement;

    if (!viewport || !world || viewport === this.mounted) return;

    this.mounted = viewport;
    this.canvas.set(
      mountCanvasViewport({ viewport, world, frameSelector: 'figure', padding: 24, start: { x: 0, y: 0, zoom: 1 } }),
    );
  }
}
