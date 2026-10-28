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
import { EMPTY, Observable, filter, fromEvent, map, switchMap, tap } from 'rxjs';
import { FrameCell, FrameGrid, FrameMessage, frameMessageOf } from '../canvas-frame';
import { Rect, Size } from '../canvas-math';

type HeightMessage = Extract<FrameMessage, { type: 'height' }>;

const cellKeyOf = (row: string, column: string) => JSON.stringify([row, column]);

@Component({
  selector: 'ethlete-canvas-frame-cell',
  template: `
    @if (!painted() && cell().screenshot; as screenshot) {
      <img [src]="screenshot" (load)="readScreenshotSize($event)" class="absolute left-0 top-0 max-w-none" alt="" />
    }
    @if (live()) {
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
  host: {
    class: 'relative block',
    '[style.width.px]': 'size()?.width ?? 0',
    '[style.height.px]': 'size()?.height ?? 0',
    '[attr.data-cell-id]': 'cell().id',
  },
})
export class CanvasFrameCellComponent {
  private sanitizer = inject(DomSanitizer);

  public cell = input.required<FrameCell>();
  public live = input(false);

  private iframe = viewChild<ElementRef<HTMLIFrameElement>>('iframe');

  protected url = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.cell().src));

  protected size = signal<Size | null>(null);

  protected painted = linkedSignal<string | null, boolean>({
    source: () => (this.live() ? this.cell().src : null),
    computation: () => false,
  });

  constructor() {
    toObservable(this.iframe)
      .pipe(
        switchMap((iframe) => (iframe ? this.reportedSizes$(iframe.nativeElement) : EMPTY)),
        tap((size) => {
          this.size.set(size);
          this.painted.set(true);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected readScreenshotSize(event: Event) {
    const image = event.target as HTMLImageElement;

    this.size.set({ width: image.naturalWidth, height: image.naturalHeight });
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

/** The cells of a frame's grid under a header row of interactions, each row led by its state. */
@Component({
  selector: 'ethlete-canvas-frame-grid',
  template: `
    <div
      #table
      [style.grid-template-columns]="'auto repeat(' + grid().columns.length + ', auto)'"
      class="absolute left-0 top-0 grid w-max items-center gap-x-[3.2rem] gap-y-[2.4rem] p-[2.4rem] text-[1.2rem] text-text-muted"
    >
      <span></span>
      @for (column of grid().columns; track column) {
        <span data-grid-column>{{ column }}</span>
      }
      @for (row of grid().rows; track row) {
        <span class="pr-[0.8rem]" data-grid-row>{{ row }}</span>
        @for (column of grid().columns; track column) {
          @if (cellOf(row, column); as cell) {
            <ethlete-canvas-frame-cell #cell [cell]="cell" [live]="live()" />
          } @else {
            <span></span>
          }
        }
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CanvasFrameCellComponent],
})
export class CanvasFrameGridComponent {
  public grid = input.required<FrameGrid>();
  public live = input(false);

  public sizeChange = output<Size>();
  /** Each cell's box in CSS pixels from the grid's top left corner, by cell id. */
  public cellsChange = output<Record<string, Rect>>();

  private table = viewChild.required<ElementRef<HTMLElement>>('table');
  private cells = viewChildren('cell', { read: ElementRef<HTMLElement> });

  private cellAt = computed(
    () => new Map<string, FrameCell>(this.grid().cells.map((cell) => [cellKeyOf(cell.row, cell.column), cell])),
  );

  constructor() {
    toObservable(this.cells)
      .pipe(
        switchMap((cells) => this.resized$([this.table().nativeElement, ...cells.map((cell) => cell.nativeElement)])),
        tap(() => this.report()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected cellOf(row: string, column: string) {
    return this.cellAt().get(cellKeyOf(row, column));
  }

  private report() {
    const table = this.table().nativeElement;

    this.sizeChange.emit({ width: table.offsetWidth, height: table.offsetHeight });
    this.cellsChange.emit(
      Object.fromEntries(
        this.cells().map(({ nativeElement: cell }) => [
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
