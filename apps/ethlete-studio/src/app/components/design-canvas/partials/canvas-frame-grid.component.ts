import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import {
  EMPTY,
  Observable,
  catchError,
  combineLatest,
  defer,
  filter,
  fromEvent,
  map,
  of,
  switchMap,
  take,
  tap,
  timer,
} from 'rxjs';
import {
  ColorScheme,
  FrameCell,
  FrameGrid,
  FrameMessage,
  SCHEME_LABELS,
  frameMessageOf,
  withScheme,
} from '../canvas-frame';
import { Rect, Size } from '../canvas-math';
import { paintedFrame$ } from '../frame-paint';
import { ShotStateComponent, ShotStateDirective } from './shot-state';

type HeightMessage = Extract<FrameMessage, { type: 'height' }>;

const cellKeyOf = (row: string, column: string) => JSON.stringify([row, column]);

const settledKeyOf = (id: string, scheme: ColorScheme | null) => JSON.stringify([id, scheme]);

export const LIVE_REVEAL_TIMEOUT_MS = 3000;

@Component({
  selector: 'ethlete-canvas-frame-cell',
  template: `
    @if (screenshot(); as screenshot) {
      <img
        #shot
        #shotState="ethleteShot"
        [src]="screenshot"
        [class.opacity-0]="painted()"
        (load)="readScreenshotSize($event)"
        (error)="loadEnd.emit()"
        class="absolute left-0 top-0 max-w-none"
        alt=""
        ethleteShot
      />
      @if (!painted()) {
        <ethlete-shot-state [state]="shotState.state()" />
      }
    }
    @if (live() || painted()) {
      <iframe
        #iframe
        [src]="url()"
        [title]="cell().label"
        [class.opacity-0]="!painted()"
        class="absolute inset-0 size-full border-0 [color-scheme:normal] group-data-[dragging]/canvas:pointer-events-none"
      ></iframe>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ShotStateDirective, ShotStateComponent],
  host: {
    class: 'relative block',
    '[style.width.px]': 'cell().width ?? size()?.width ?? 0',
    '[style.height.px]': 'size()?.height ?? 0',
    '[attr.data-cell-id]': 'cell().id',
    '[attr.data-cell-scheme]': 'scheme()',
    '[class.min-h-20]': 'failed()',
    '[class.min-w-40]': 'failed()',
  },
})
export class CanvasFrameCellComponent {
  private sanitizer = inject(DomSanitizer);

  public cell = input.required<FrameCell>();
  public live = input(false);
  public scheme = input<ColorScheme | null>(null);
  public revealLive = input(true);
  public loadEnd = output<void>();
  public pageReadyChange = output<boolean>();

  private iframe = viewChild<ElementRef<HTMLIFrameElement>>('iframe');

  private shot = viewChild<ElementRef<HTMLImageElement>>('shot');

  public shotState = viewChild(ShotStateDirective);

  private pageRevealed$ = toObservable(computed(() => this.live() && this.revealLive()));

  private src = computed(() => this.schemed(this.cell().src));

  protected screenshot = computed(() => this.schemed(this.cell().screenshot ?? ''));

  protected url = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.src()));

  protected size = signal<Size | null>(null);

  protected painted = linkedSignal<string, boolean>({ source: () => this.src(), computation: () => false });

  protected failed = computed(() => this.shotState()?.state() === 'failed');

  private page = computed(() => ({ iframe: this.iframe()?.nativeElement ?? null, src: this.src() }));

  constructor() {
    toObservable(this.page)
      .pipe(
        tap(() => this.pageReadyChange.emit(false)),
        switchMap(({ iframe }) =>
          iframe
            ? combineLatest([this.reportedSizes$(iframe), paintedFrame$(iframe).pipe(filter(Boolean))]).pipe(
                tap(() => this.pageReadyChange.emit(true)),
                switchMap(([size]) =>
                  this.pageRevealed$.pipe(
                    filter(Boolean),
                    take(1),
                    map(() => size),
                  ),
                ),
              )
            : EMPTY,
        ),
        tap((size) => {
          this.size.set(size);
          this.painted.set(true);
          this.loadEnd.emit();
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    toObservable(this.live)
      .pipe(
        switchMap((live) => (live ? EMPTY : this.decodedShot$())),
        tap((image) => {
          if (image) this.size.set({ width: image.naturalWidth, height: image.naturalHeight });
          this.painted.set(false);
          this.pageReadyChange.emit(false);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected readScreenshotSize(event: Event) {
    const image = event.target as HTMLImageElement;

    if (!this.painted()) this.size.set({ width: image.naturalWidth, height: image.naturalHeight });
    this.loadEnd.emit();
  }

  private decodedShot$() {
    const image = this.shot()?.nativeElement;

    if (!this.painted()) return EMPTY;
    if (!image) return of(null);

    return defer(() => image.decode()).pipe(
      map(() => image),
      catchError(() => of(null)),
    );
  }

  private schemed(url: string) {
    const scheme = this.scheme();

    return scheme ? withScheme(url, scheme) : url;
  }

  private reportedSizes$(iframe: HTMLIFrameElement): Observable<Size> {
    const host = iframe.ownerDocument.defaultView;

    if (!host) return EMPTY;

    return fromEvent<MessageEvent>(host, 'message').pipe(
      filter((event) => !!iframe.contentWindow && event.source === iframe.contentWindow),
      map(({ data }) => frameMessageOf(data)),
      filter((message): message is HeightMessage => message?.type === 'height'),
      map((message) => ({ width: message.width ?? 0, height: message.height })),
    );
  }
}

/**
 * The cells of a frame's grid under a header row of interactions, each row led by its state. A `sheet` grid draws its
 * cells as one sheet on a sunken body: a `table` sheet every row in that table, each cell centred; a `groups` sheet the
 * rows that use more than the first column as that table, the others packed as many to a line as the grid has columns,
 * each under its state. A grid with `schemes` draws its columns once per colour scheme, side by side under the scheme.
 */
@Component({
  selector: 'ethlete-canvas-frame-grid',
  template: `
    @if (sheet(); as sheet) {
      <div
        #table
        [class.invisible]="!revealed()"
        [style.grid-template-columns]="templateColumns()"
        class="absolute left-0 top-0 grid w-max gap-px bg-surface-sunken px-[2.4rem] pb-[2.4rem] pt-[1.6rem] text-[1.1rem]/[1.4rem] text-text-muted"
        data-grid-sheet
      >
        @if (sheet.interactive.length > 0) {
          <span
            class="col-span-full mb-[0.8rem] border-b border-surface-border pb-[0.4rem] text-[1rem] uppercase tracking-[0.04em]"
            data-grid-group
            >States by interaction</span
          >
          <ng-container *ngTemplateOutlet="schemeHeads; context: { $implicit: 'mb-[0.8rem]' }" />
          <span></span>
          @for (scheme of schemes(); track $index; let firstScheme = $first) {
            @if (!firstScheme) {
              <span></span>
            }
            @for (column of grid().columns; track column) {
              <span class="self-end pb-[0.4rem] font-code" data-grid-column>{{ column }}</span>
            }
          }
          @for (row of sheet.interactive; track row) {
            <span class="self-center pr-[0.8rem] font-code" data-grid-row>{{ row }}</span>
            @for (scheme of schemes(); track $index; let firstScheme = $first) {
              @if (!firstScheme) {
                <span></span>
              }
              @for (column of grid().columns; track column) {
                <div
                  [class.grid]="sheet.centered"
                  [class.place-items-center]="sheet.centered"
                  class="bg-surface px-space-1 py-space-2 ring-1 ring-surface-border"
                  data-grid-cell
                >
                  @if (cellOf(row, column); as cell) {
                    <ethlete-canvas-frame-cell
                      #cell
                      [cell]="cell"
                      [scheme]="scheme"
                      [live]="cellLive(cell.id)"
                      [revealLive]="liveRevealed()"
                      (loadEnd)="settle(cell.id, scheme)"
                      (pageReadyChange)="markReady({ id: cell.id, scheme }, $event)"
                    />
                  } @else if (drawnRows().has(row)) {
                    <span class="font-code text-text-muted italic" data-grid-empty>not drawn</span>
                  }
                </div>
              }
            }
          }
        }
        @if (sheet.packed.length > 0) {
          <span
            class="col-span-full mb-[0.8rem] mt-[2.4rem] border-b border-surface-border pb-[0.4rem] text-[1rem] uppercase tracking-[0.04em] first:mt-0"
            data-grid-group
            >Rest only</span
          >
          <ng-container *ngTemplateOutlet="schemeHeads; context: { $implicit: 'mb-[0.8rem]' }" />
          @for (line of sheet.packed; track $index; let firstLine = $first) {
            <span></span>
            @for (scheme of schemes(); track $index; let firstScheme = $first) {
              @if (!firstScheme) {
                <span></span>
              }
              @for (row of line; track row) {
                <span [class.pt-3]="!firstLine" class="self-end pb-[0.4rem] font-code" data-grid-row>{{ row }}</span>
              }
              @for (blank of blanksOf(line); track $index) {
                <span></span>
              }
            }
            <span></span>
            @for (scheme of schemes(); track $index; let firstScheme = $first) {
              @if (!firstScheme) {
                <span></span>
              }
              @for (row of line; track row) {
                <div class="bg-surface px-space-1 py-space-2 ring-1 ring-surface-border" data-grid-cell>
                  @if (cellOf(row, sheet.first); as cell) {
                    <ethlete-canvas-frame-cell
                      #cell
                      [cell]="cell"
                      [scheme]="scheme"
                      [live]="cellLive(cell.id)"
                      [revealLive]="liveRevealed()"
                      (loadEnd)="settle(cell.id, scheme)"
                      (pageReadyChange)="markReady({ id: cell.id, scheme }, $event)"
                    />
                  }
                </div>
              }
              @for (blank of blanksOf(line); track $index) {
                <span></span>
              }
            }
          }
        }
      </div>
    } @else {
      <div
        #table
        [class.invisible]="!revealed()"
        [style.grid-template-columns]="templateColumns()"
        class="absolute left-0 top-0 grid w-max items-center gap-x-[3.2rem] gap-y-[2.4rem] p-[2.4rem] text-[1.2rem] text-text-muted"
      >
        <ng-container *ngTemplateOutlet="schemeHeads; context: { $implicit: 'self-end' }" />
        <span></span>
        @for (scheme of schemes(); track $index; let firstScheme = $first) {
          @if (!firstScheme) {
            <span></span>
          }
          @for (column of grid().columns; track column) {
            <span data-grid-column>{{ column }}</span>
          }
        }
        @for (row of grid().rows; track row) {
          <span class="pr-[0.8rem]" data-grid-row>{{ row }}</span>
          @for (scheme of schemes(); track $index; let firstScheme = $first) {
            @if (!firstScheme) {
              <span></span>
            }
            @for (column of grid().columns; track column) {
              @if (cellOf(row, column); as cell) {
                <ethlete-canvas-frame-cell
                  #cell
                  [cell]="cell"
                  [scheme]="scheme"
                  [live]="cellLive(cell.id)"
                  [revealLive]="liveRevealed()"
                  (loadEnd)="settle(cell.id, scheme)"
                  (pageReadyChange)="markReady({ id: cell.id, scheme }, $event)"
                />
              } @else if (drawnRows().has(row)) {
                <span class="font-code text-text-muted italic" data-grid-empty>not drawn</span>
              } @else {
                <span></span>
              }
            }
          }
        }
      </div>
    }
    <ng-template #schemeHeads let-placement>
      @if (grid().schemes) {
        <span></span>
        @for (scheme of schemes(); track $index; let firstScheme = $first) {
          @if (!firstScheme) {
            <span></span>
          }
          <span
            [class]="placement"
            [style.grid-column]="'span ' + grid().columns.length"
            class="border-b border-surface-border pb-[0.4rem] text-[1rem] uppercase tracking-[0.04em]"
            data-grid-scheme
            >{{ schemeLabelOf(scheme) }}</span
          >
        }
      }
    </ng-template>
    @if (!revealed()) {
      <span
        class="absolute left-[2.4rem] top-[2.4rem] size-[1.2rem] animate-pulse rounded-full bg-accent"
        title="Rendering"
        data-grid-loading
      ></span>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CanvasFrameCellComponent, NgTemplateOutlet],
})
export class CanvasFrameGridComponent {
  public grid = input.required<FrameGrid>();
  public live = input(false);
  /** The cells that go live while `live`; `null` makes every cell live. */
  public liveCells = input<ReadonlySet<string> | null>(null);

  public sizeChange = output<Size>();
  /** Each cell's box in CSS pixels from the grid's top left corner, by cell id. */
  public cellsChange = output<Record<string, Rect>>();

  private table = viewChild<ElementRef<HTMLElement>>('table');
  private cells = viewChildren('cell', { read: ElementRef<HTMLElement> });

  private cellAt = computed(
    () => new Map<string, FrameCell>(this.grid().cells.map((cell) => [cellKeyOf(cell.row, cell.column), cell])),
  );

  protected drawnRows = computed(() => new Set(this.grid().cells.map((cell) => cell.row)));

  protected schemes = computed<(ColorScheme | null)[]>(() => this.grid().schemes ?? [null]);

  protected templateColumns = computed(() => {
    const repeat = `repeat(${this.grid().columns.length}, ${this.grid().sheet ? 'max-content' : 'auto'})`;
    const groups = this.schemes().map(() => repeat);

    return this.grid().sheet ? `minmax(12rem, max-content) ${groups.join(' 1.6rem ')}` : `auto ${groups.join(' 0 ')}`;
  });

  private settledCells = linkedSignal<string, ReadonlySet<string>>({
    source: () =>
      [this.schemes().join(' '), ...this.grid().cells.map((cell) => `${cell.id}\n${cell.screenshot ?? ''}`)].join('\n'),
    computation: () => new Set(),
  });

  protected revealed = computed(() => {
    const settled = this.settledCells();
    const schemes = this.schemes();

    return this.grid().cells.every(
      (cell) => !cell.screenshot || schemes.every((scheme) => settled.has(settledKeyOf(cell.id, scheme))),
    );
  });

  private liveKeys = computed(() => {
    const schemes = this.schemes();

    return this.grid()
      .cells.filter((cell) => this.cellLive(cell.id))
      .flatMap((cell) => schemes.map((scheme) => settledKeyOf(cell.id, scheme)));
  });

  private liveRound = computed(() =>
    this.live() ? [...this.liveKeys(), ...this.grid().cells.map((cell) => cell.src)].join('\n') : null,
  );

  private readyCells = signal<ReadonlySet<string>>(new Set());

  private liveTimedOut = linkedSignal<string | null, boolean>({
    source: () => this.liveRound(),
    computation: () => false,
  });

  protected liveRevealed = computed(() => {
    const ready = this.readyCells();

    return this.liveTimedOut() || this.liveKeys().every((key) => ready.has(key));
  });

  private observed = computed(() => {
    const table = this.table()?.nativeElement;

    return table && this.revealed() ? [table, ...this.cells().map((cell) => cell.nativeElement)] : [];
  });

  protected sheet = computed(() => {
    const { columns, rows, sheet } = this.grid();

    if (!sheet) return null;

    const [first = ''] = columns;
    const restOnly = (row: string) =>
      sheet === 'groups' && columns.slice(1).every((column) => !this.cellOf(row, column));
    const rest = rows.filter(restOnly);
    const perLine = Math.max(columns.length, 1);

    return {
      first,
      centered: sheet === 'table',
      interactive: rows.filter((row) => !restOnly(row)),
      packed: Array.from({ length: Math.ceil(rest.length / perLine) }, (_, line) =>
        rest.slice(line * perLine, (line + 1) * perLine),
      ),
    };
  });

  constructor() {
    toObservable(this.observed)
      .pipe(
        switchMap((elements) => this.resized$(elements)),
        tap(() => this.report()),
        takeUntilDestroyed(),
      )
      .subscribe();

    toObservable(this.liveRound)
      .pipe(
        switchMap((round) => (round === null ? EMPTY : timer(LIVE_REVEAL_TIMEOUT_MS))),
        tap(() => this.liveTimedOut.set(true)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected cellLive(id: string) {
    const liveCells = this.liveCells();

    return this.live() && (liveCells === null || liveCells.has(id));
  }

  protected settle(id: string, scheme: ColorScheme | null) {
    const key = settledKeyOf(id, scheme);

    this.settledCells.update((settled) => (settled.has(key) ? settled : new Set(settled).add(key)));
  }

  protected markReady({ id, scheme }: { id: string; scheme: ColorScheme | null }, ready: boolean) {
    const key = settledKeyOf(id, scheme);

    this.readyCells.update((cells) => {
      if (cells.has(key) === ready) return cells;

      const next = new Set(cells);

      if (ready) next.add(key);
      else next.delete(key);

      return next;
    });
  }

  protected schemeLabelOf(scheme: ColorScheme | null) {
    return scheme ? SCHEME_LABELS[scheme] : '';
  }

  protected blanksOf(line: string[]) {
    return Array.from({ length: this.grid().columns.length - line.length });
  }

  protected cellOf(row: string, column: string) {
    return this.cellAt().get(cellKeyOf(row, column));
  }

  private report() {
    const table = this.table()?.nativeElement;

    if (!table) return;

    this.sizeChange.emit({ width: table.offsetWidth, height: table.offsetHeight });
    const [firstScheme = null] = this.schemes();

    this.cellsChange.emit(
      Object.fromEntries(
        this.cells()
          .filter(({ nativeElement: cell }) => (cell.dataset['cellScheme'] ?? null) === firstScheme)
          .map(({ nativeElement: cell }) => [
            cell.dataset['cellId'] ?? '',
            { x: cell.offsetLeft, y: cell.offsetTop, width: cell.offsetWidth, height: cell.offsetHeight },
          ]),
      ),
    );
  }

  private resized$(elements: HTMLElement[]) {
    const Observer = elements[0]?.ownerDocument.defaultView?.ResizeObserver;

    if (!Observer) return EMPTY;

    return new Observable<void>((subscriber) => {
      const observer = new Observer(() => subscriber.next());

      elements.forEach((element) => observer.observe(element));

      return () => observer.disconnect();
    });
  }
}
