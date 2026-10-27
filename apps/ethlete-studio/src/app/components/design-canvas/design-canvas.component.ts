import {
  Component,
  ElementRef,
  TemplateRef,
  ViewEncapsulation,
  afterEveryRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { dragGestureFrom, signalElementDimensions } from '@ethlete/core';
import { Subject, buffer, debounceTime, exhaustMap, tap } from 'rxjs';
import { frameSizesOf, frameSizesWith, rememberView, rememberedView, FrameSize } from '../../studio-view/remembered';
import { CanvasFrame } from './canvas-frame';
import { CanvasNote, NOTE_BELOW_GAP, noteConnectorPath, noteKeyOf, placeNoteMarkers, placeNotes } from './canvas-note';
import { CanvasPin, FrameOutline, FramePoint } from './canvas-pin';
import {
  Camera,
  Point,
  Rect,
  Size,
  boundingRect,
  fitRect,
  focusRect,
  layoutGrid,
  layoutMatrix,
  layoutSheet,
  panCamera,
  rectsIntersect,
  screenToWorld,
  visibleWorldRect,
  wheelZoomFactor,
  zoomAtPoint,
} from './canvas-math';
import { CanvasLine, flowCurveOf, flowLabelMaxWidthOf, layoutFlow } from './flow-layout';
import { CanvasFrameComponent } from './partials/canvas-frame.component';

const SPACING = { columnGap: 40, rowGap: 120 };
const FLOW_SPACING = { columnGap: 280, rowGap: 120, maxColumnGap: 560 };

const sameTops = (a: Record<string, number>, b: Record<string, number>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, top]) => b[key] === top);

let canvasCount = 0;
const FITTED_ROW_GAP = 48;
const GROUP_GAP_FACTOR = 2;
const GRID_SPACING = { columnGap: 40, lineWidth: 1600 };
const FALLBACK_WIDTH = 320;
const FALLBACK_HEIGHT = 600;
const FIT_PADDING = 64;
const ROW_LABEL_GUTTER = 160;
const COLUMN_HEAD_ROOM = 64;
const GROUP_HEAD_ROOM = 48;
const LIVE_MARGIN = 400;
const LIVE_MIN_ZOOM = 0.5;
const LABEL_MIN_ZOOM = 0.25;
const ZOOM_STEP = 1.5;
const MEASURE_WRITE_MS = 500;

/** Neighbouring columns with the same group `key` share one head above their own. */
export type CanvasColumnGroup = { key: string; label: string; note?: string; title?: string };

export type CanvasColumn = {
  key: string;
  label: string;
  muted?: boolean;
  title?: string;
  /** A muted line below the label. */
  note?: string;
  group?: CanvasColumnGroup;
  /** A column without frames, `width` wide, with `note` below its head; its head is a button that emits `columnToggle`. */
  folded?: { width: number; note?: string };
};

type ColumnGroupHead = CanvasColumnGroup & { x: number; width: number };

type PlacedFrame = Rect & { frame: CanvasFrame; unsized: boolean; live: boolean; active: boolean; selected: boolean };

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

@Component({
  selector: 'ethlete-design-canvas',
  templateUrl: './design-canvas.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, NgTemplateOutlet, CanvasFrameComponent],
  host: {
    class:
      'group/canvas relative block h-full touch-none overflow-hidden overscroll-none bg-[var(--et-surface-background-solid)] text-[var(--et-surface-color-solid)] select-none',
    '[class.cursor-grab]': 'spaceHeld() && !panning()',
    '[class.cursor-grabbing]': 'panning()',
    '[attr.data-dragging]': '(spaceHeld() || panning()) || null',
    '(wheel)': 'moveCameraByWheel($event)',
    '(pointerdown)': 'startPan($event)',
    '(click)': 'clearSelection($event)',
    '(window:keydown)': 'handleShortcut($event)',
    '(window:keyup)': 'releaseSpace($event)',
    '(window:blur)': 'spaceHeld.set(false)',
  },
})
export class DesignCanvasComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  public frames = input.required<CanvasFrame[]>();

  /**
   * `sheet` puts each row of frames on its own line; `grid` flows the frames as tiles with their label below;
   * `matrix` puts each frame at its row and its `column`, with a head over each of `columns`; `flow` lays the
   * frames out left to right along `lines`.
   */
  public arrangement = input<'sheet' | 'grid' | 'matrix' | 'flow'>('sheet');

  /** The lines a `flow` draws between its frames. */
  public lines = input<CanvasLine[]>([]);

  /** The columns of a `matrix`, in order. A column without frames still gets its head. */
  public columns = input<CanvasColumn[]>([]);

  /** Names what the canvas shows. A new key fits the camera again, or restores `restoredCamera`. */
  public cameraKey = input<string | null>(null);

  /** The camera to show instead of a fit, read when `cameraKey` changes. */
  public restoredCamera = input<Camera | null>(null);

  public pins = input<CanvasPin[]>([]);

  public outlines = input<FrameOutline[]>([]);

  /** While on, a click on a frame that has a `place` reports the point instead of selecting the frame. */
  public pointing = input(false);

  /** Names the frame a click in pointing mode lands on, before the frame's label. */
  public pointingLabel = input('Comment on');

  /** Where the projected `[canvasDraft]` content sits: on a frame, at a world point, or `null` to hide it. */
  public draft = input<FramePoint | { at: Point } | null>(null);

  public notes = input<CanvasNote[]>([]);

  /** What a note shows; without it, the note's text. A note holding a `[data-canvas-popover]` element rises above the comment pins. */
  public noteTemplate = input<TemplateRef<{ $implicit: CanvasNote }> | null>(null);

  /** What an open pin shows; without it, the pin's text. */
  public pinPopover = input<TemplateRef<{ $implicit: CanvasPin }> | null>(null);

  public pointPick = output<FramePoint>();

  /** The world point of a click on empty space in pointing mode. */
  public spacePick = output<Point>();

  /** The camera after the user moved it and it came to rest; `null` after a fit, so a reload fits again. */
  public cameraChange = output<Camera | null>();

  /** The key of a folded column or of a column group whose head the user clicked. */
  public columnToggle = output<string>();

  private noteCards = viewChildren<ElementRef<HTMLElement>>('noteCard');
  private noteColumns = viewChildren<ElementRef<HTMLElement>>('noteColumn');
  public camera = signal<Camera>({ x: 0, y: 0, zoom: 1 });
  public openPinId = signal<string | null>(null);
  protected smooth = signal(false);
  public selectedId = signal<string | null>(null);
  public activeId = linkedSignal<boolean, string | null>({ source: this.pointing, computation: () => null });
  protected spaceHeld = signal(false);
  protected panning = signal(false);
  private measured = linkedSignal<string | null, Record<string, FrameSize>>({
    source: this.cameraKey,
    computation: (key) => (key === null ? {} : frameSizesOf(rememberedView().measuredSizes ?? {}, key)),
  });
  private measure$ = new Subject<{ cameraKey: string; frameId: string; size: FrameSize }>();
  private userCamera$ = new Subject<Camera | null>();

  private dimensions = signalElementDimensions(this.host);
  private viewport = computed<Size>(() => this.dimensions().client ?? { width: 0, height: 0 });

  private noteCardTops = signal<Record<string, number>>({}, { equal: sameTops });

  /** By frame id, the height of the note column below it at zoom 1. */
  private noteColumnHeights = signal<Record<string, number>>({}, { equal: sameTops });

  private layout = computed(() => {
    const measured = this.measured();
    const frames = this.frames();
    const byId = new Map(frames.map((frame) => [frame.id, frame]));
    const known = (frame: CanvasFrame) => ({
      width: frame.width ?? measured[frame.id]?.width,
      height: frame.height ?? measured[frame.id]?.height,
    });
    const drawn = frames.filter((frame) => frame.empty === undefined).map((frame) => ({ frame, ...known(frame) }));
    const rowMax = (frame: CanvasFrame, side: 'width' | 'height') => {
      const sizes = drawn.flatMap((other) => {
        const value = other[side];

        return other.frame.row === frame.row && value !== undefined ? [value] : [];
      });

      return sizes.length > 0 ? Math.max(...sizes) : frame[side];
    };
    const sized = frames.map((frame) => {
      const { width, height } =
        frame.empty === undefined ? known(frame) : { width: rowMax(frame, 'width'), height: rowMax(frame, 'height') };

      return {
        id: frame.id,
        row: frame.row ?? '',
        ...(frame.rowLabel === undefined ? {} : { rowLabel: frame.rowLabel }),
        ...(frame.rowGroup === undefined ? {} : { rowGroup: frame.rowGroup }),
        column: frame.column ?? '',
        fitted: frame.width === undefined,
        width: width ?? FALLBACK_WIDTH,
        height: height ?? FALLBACK_HEIGHT,
        unsized: width === undefined || height === undefined,
      };
    });
    const unsized = new Set(sized.filter((frame) => frame.unsized).map((frame) => frame.id));
    const arrangement = this.arrangement();
    const columns = this.columns();
    const rowGap = frames.every((frame) => frame.width === undefined) ? FITTED_ROW_GAP : SPACING.rowGap;
    const matrix =
      arrangement === 'matrix'
        ? layoutMatrix({
            frames: sized,
            columns: columns.map((column) => column.key),
            spacing: { ...SPACING, rowGap, groupGap: rowGap * GROUP_GAP_FACTOR, emptyColumnWidth: FALLBACK_WIDTH },
            emptyWidths: Object.fromEntries(
              columns.flatMap((column) => (column.folded ? [[column.key, column.folded.width]] : [])),
            ),
            below: Object.fromEntries(
              Object.entries(this.noteColumnHeights()).map(([id, height]) => [id, NOTE_BELOW_GAP + height]),
            ),
          })
        : null;
    const flow =
      arrangement === 'flow'
        ? {
            rows: [],
            frames: layoutFlow(
              sized.map((frame) => ({ ...frame, ...(byId.get(frame.id)?.at ? { at: byId.get(frame.id)?.at } : {}) })),
              { links: this.lines(), spacing: FLOW_SPACING },
            ),
          }
        : null;
    const sheet =
      matrix ??
      flow ??
      (arrangement === 'grid' ? layoutGrid(sized, { ...GRID_SPACING, rowGap }) : layoutSheet(sized, SPACING));
    const heads = (matrix?.columns ?? []).flatMap((placed) => {
      const column = columns.find((candidate) => candidate.key === placed.name);

      return column ? [{ ...column, x: placed.x, width: placed.width }] : [];
    });

    const groups = heads.reduce<ColumnGroupHead[]>((placed, head) => {
      const last = placed.at(-1);

      if (!head.group) return placed;
      if (last?.key === head.group.key)
        return [...placed.slice(0, -1), { ...last, width: head.x + head.width - last.x }];

      return [...placed, { ...head.group, x: head.x, width: head.width }];
    }, []);

    return {
      heads,
      groups,
      rows: sheet.rows.filter((row) => row.name !== ''),
      frames: sheet.frames.flatMap((placed) => {
        const frame = byId.get(placed.id);

        return frame ? [{ ...placed, frame, unsized: unsized.has(frame.id) }] : [];
      }),
    };
  });

  protected rows = computed(() => this.layout().rows);

  protected columnHeads = computed(() => this.layout().heads);

  protected groupHeads = computed(() => this.layout().groups);

  protected placedLines = computed(() => {
    const byId = new Map(this.layout().frames.map((placed) => [placed.frame.id, placed]));

    return this.lines().flatMap((line, index) => {
      const from = byId.get(line.from);
      const to = byId.get(line.to);

      return from && to
        ? [{ key: `${index} ${line.from} ${line.to}`, label: line.label, ...flowCurveOf(from, to) }]
        : [];
    });
  });

  private bounds = computed(() => {
    const { frames, heads } = this.layout();
    const middles = this.placedLines().map(({ middle }) => ({ ...middle, width: 1, height: 1 }));
    const notes = this.notes().flatMap((note) => (note.at ? [{ ...note.at, width: 1, height: 1 }] : []));

    return (
      boundingRect([...frames, ...middles, ...notes]) ??
      boundingRect(heads.map((head) => ({ x: head.x, y: 0, width: head.width, height: 1 })))
    );
  });

  protected placedFrames = computed<PlacedFrame[]>(() => {
    const camera = this.camera();
    const visible =
      camera.zoom >= LIVE_MIN_ZOOM
        ? visibleWorldRect({ camera, viewport: this.viewport(), margin: LIVE_MARGIN })
        : null;
    const activeId = this.activeId();
    const selectedId = this.selectedId();

    return this.layout().frames.map(({ x, y, width, height, frame, unsized }) => ({
      x,
      y,
      width,
      height,
      frame,
      unsized,
      active: frame.id === activeId,
      selected: frame.id === selectedId,
      live: frame.id === activeId || (!!visible && rectsIntersect({ x, y, width, height }, visible)),
    }));
  });

  protected placedPins = computed(() => {
    const byId = new Map(this.layout().frames.map((placed) => [placed.frame.id, placed]));
    const openId = this.openPinId();

    return this.pins().flatMap((pin) => {
      const frame = byId.get(pin.frameId);

      return frame
        ? [
            {
              pin,
              x: frame.x + (pin.point?.x ?? frame.width),
              y: frame.y + (pin.point?.y ?? 0),
              open: pin.id === openId,
            },
          ]
        : [];
    });
  });

  protected placedOutlines = computed(() => {
    const byId = new Map(this.layout().frames.map((placed) => [placed.frame.id, placed]));

    return this.outlines().flatMap((outline) => {
      const frame = byId.get(outline.frameId);

      return frame ? [{ ...outline, x: frame.x + outline.x, y: frame.y + outline.y }] : [];
    });
  });

  private framesById = computed(() => new Map(this.layout().frames.map((placed) => [placed.frame.id, placed])));

  protected placedNotes = computed(() =>
    placeNotes(this.notes(), { frames: this.framesById(), bounds: boundingRect(this.layout().frames) }),
  );

  protected noteMarkers = computed(() => placeNoteMarkers(this.notes(), this.framesById()));

  protected readonly NOTE_KEY_OF = noteKeyOf;

  protected readonly FLOW_LABEL_MAX_WIDTH = flowLabelMaxWidthOf(FLOW_SPACING);

  protected placedDraft = computed(() => {
    const draft = this.draft();

    if (draft && 'at' in draft) return draft.at;

    const frame = draft && this.layout().frames.find((placed) => placed.frame.id === draft.frameId);

    return frame && draft ? { x: frame.x + (draft.point?.x ?? frame.width), y: frame.y + (draft.point?.y ?? 0) } : null;
  });

  protected pointTargets = computed(() =>
    this.pointing() ? this.layout().frames.filter((placed) => placed.frame.place) : [],
  );

  protected worldTransform = computed(() => {
    const { x, y, zoom } = this.camera();

    return `translate(${x}px, ${y}px) scale(${zoom})`;
  });

  protected labelScale = computed(() => 1 / Math.max(this.camera().zoom, LABEL_MIN_ZOOM));

  protected notesCompact = computed(() => this.camera().zoom < LABEL_MIN_ZOOM);

  protected noteConnectors = computed(() => {
    if (this.notesCompact()) return [];

    const tops = this.noteCardTops();
    const scale = this.labelScale();

    return this.noteMarkers().flatMap((marker) => {
      const top = tops[marker.key];

      return top === undefined ? [] : [{ key: marker.key, path: noteConnectorPath(marker, { top, scale }) }];
    });
  });

  protected zoomPercent = computed(() => Math.round(this.camera().zoom * 100));

  private panStart$ = new Subject<PointerEvent>();
  private swallowNextClick = false;

  private fittedFor: string | null | undefined = undefined;

  private following = false;

  protected readonly ZOOM_STEP = ZOOM_STEP;

  protected readonly ARROW_ID = `et-design-canvas-arrow-${canvasCount++}`;

  constructor() {
    afterEveryRender({
      read: () => {
        const cards = this.noteCards();

        if (!this.notesCompact()) {
          this.noteColumnHeights.set(
            Object.fromEntries(
              this.noteColumns().flatMap(({ nativeElement }) => {
                const frameId = nativeElement.dataset['noteFrame'];

                return frameId === undefined ? [] : [[frameId, nativeElement.offsetHeight]];
              }),
            ),
          );
        }

        if (cards.length === 0 && Object.keys(this.noteCardTops()).length === 0) return;

        this.noteCardTops.set(
          Object.fromEntries(
            cards.map(({ nativeElement }) => [nativeElement.dataset['noteKey'] ?? '', nativeElement.offsetTop]),
          ),
        );
      },
    });

    effect(() => {
      const bounds = this.bounds();
      const viewport = this.viewport();
      const key = this.cameraKey();

      if (!bounds || viewport.width === 0 || viewport.height === 0) return;

      untracked(() => {
        const fitted = this.fitted(bounds, viewport);

        if (this.fittedFor === key) {
          if (this.following) this.camera.set(fitted);

          return;
        }

        const restored = this.restoredCamera();

        this.fittedFor = key;
        this.following = restored === null;
        this.camera.set(restored ?? fitted);
      });
    });

    this.userCamera$
      .pipe(
        debounceTime(300),
        tap((camera) => this.cameraChange.emit(camera)),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.measure$
      .pipe(
        buffer(this.measure$.pipe(debounceTime(MEASURE_WRITE_MS))),
        tap((measures) =>
          rememberView({
            measuredSizes: measures.reduce(
              (stored, measure) => frameSizesWith({ stored, ...measure }),
              rememberedView().measuredSizes ?? {},
            ),
          }),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.panStart$
      .pipe(
        exhaustMap((event) => dragGestureFrom(event, this.host.nativeElement, { commitThreshold: 0 })),
        tap((gesture) => {
          if (gesture.type === 'move') {
            this.moveCamera(panCamera(this.camera(), { x: gesture.data.stepX, y: gesture.data.stepY }));
          }

          this.panning.set(gesture.type === 'start' || gesture.type === 'move');
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected select(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.consumeSwallowedClick()) return;
    this.selectedId.set(id);
    if (this.activeId() !== id) this.activeId.set(null);
  }

  protected pickPoint(frame: { id: string; width: number }, event: Event) {
    event.stopPropagation();
    if (this.consumeSwallowedClick()) return;
    if (!(event instanceof MouseEvent)) {
      this.pointPick.emit({ frameId: frame.id, point: null });

      return;
    }

    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const scale = box.width / frame.width;

    this.pointPick.emit({
      frameId: frame.id,
      point: { x: Math.max(0, (event.clientX - box.left) / scale), y: Math.max(0, (event.clientY - box.top) / scale) },
    });
  }

  protected pickCaption(frame: CanvasFrame, event: Event) {
    event.stopPropagation();
    if (this.consumeSwallowedClick()) return;
    this.pointPick.emit({ frameId: frame.id, point: null });
  }

  protected toggleColumn(key: string, event: MouseEvent) {
    event.stopPropagation();
    this.columnToggle.emit(key);
  }

  protected togglePin(id: string, event: MouseEvent) {
    event.stopPropagation();
    this.openPinId.set(this.openPinId() === id ? null : id);
  }

  /** Opens a pin's text and moves the camera to its frame. */
  public openPin(id: string) {
    const pin = this.pins().find((candidate) => candidate.id === id);

    this.openPinId.set(pin ? id : null);
    if (pin) this.focusFrame(pin.frameId);
  }

  /** Selects a frame and moves the camera to it. */
  public focusFrame(id: string) {
    const placed = this.layout().frames.find((candidate) => candidate.frame.id === id);

    if (!placed) return;

    this.selectedId.set(id);

    const camera = focusRect({ rect: placed, camera: this.camera(), viewport: this.viewport(), padding: FIT_PADDING });

    if (camera) this.moveCamera(camera, true);
  }

  protected activate(id: string) {
    if (this.pointing()) return;
    if (this.frames().find((frame) => frame.id === id)?.empty !== undefined) return;

    this.selectedId.set(id);
    this.activeId.set(id);
  }

  protected leaveActiveFrame() {
    this.activeId.set(null);
  }

  protected clearSelection(event: MouseEvent) {
    if (this.consumeSwallowedClick()) return;
    if (event.target !== this.host.nativeElement) return;
    if (this.pointing()) this.spacePick.emit(screenToWorld(this.camera(), this.pointerPosition(event)));
    this.openPinId.set(null);
    this.selectedId.set(null);
    this.activeId.set(null);
  }

  protected storeHeight(id: string, height: number) {
    this.storeMeasure(id, { height });
  }

  protected storeWidth(id: string, width: number) {
    this.storeMeasure(id, { width });
  }

  protected startPan(event: PointerEvent) {
    const middle = event.button === 1;

    if (!middle && !(event.button === 0 && this.spaceHeld())) return;

    event.preventDefault();
    this.swallowNextClick = !middle;
    this.panStart$.next(event);
  }

  protected moveCameraByWheel(event: WheelEvent) {
    event.preventDefault();

    const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
    const deltaX = event.deltaX * scale;
    const deltaY = event.deltaY * scale;

    if (event.ctrlKey || event.metaKey) {
      const zoom = this.camera().zoom * wheelZoomFactor(deltaY);

      this.moveCamera(zoomAtPoint({ camera: this.camera(), point: this.pointerPosition(event), zoom }));
    } else if (event.shiftKey) {
      this.moveCamera(panCamera(this.camera(), { x: -(deltaX || deltaY), y: 0 }));
    } else {
      this.moveCamera(panCamera(this.camera(), { x: -deltaX, y: -deltaY }));
    }
  }

  protected handleShortcut(event: KeyboardEvent) {
    if (isEditable(event.target)) return;

    if (event.code === 'Space') {
      event.preventDefault();
      this.spaceHeld.set(true);

      return;
    }

    if (event.key === 'Escape') {
      if (this.openPinId()) this.openPinId.set(null);
      else if (this.activeId()) this.leaveActiveFrame();
      else this.selectedId.set(null);

      return;
    }

    if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;

    const shortcuts: Record<string, () => void> = {
      Digit1: () => this.fitAll(),
      Digit2: () => this.fitSelection(),
      Digit0: () => this.zoomTo(1),
    };
    const shortcut = shortcuts[event.code];

    if (!shortcut) return;

    event.preventDefault();
    shortcut();
  }

  protected releaseSpace(event: KeyboardEvent) {
    if (event.code === 'Space') this.spaceHeld.set(false);
  }

  /** Fits every frame into view, and keeps fitting as frames report their size until the user moves the camera. */
  public fitAll() {
    const bounds = this.bounds();

    if (bounds) this.moveCamera(this.fitted(bounds, this.viewport()), true);
    this.following = true;
    this.userCamera$.next(null);
  }

  public fitSelection() {
    const selected = this.placedFrames().find((placed) => placed.selected);

    if (selected) this.moveCamera(fitRect({ rect: selected, viewport: this.viewport(), padding: FIT_PADDING }), true);
  }

  protected zoomTo(zoom: number) {
    const { width, height } = this.viewport();

    this.moveCamera(zoomAtPoint({ camera: this.camera(), point: { x: width / 2, y: height / 2 }, zoom }), true);
  }

  protected zoomBy(factor: number) {
    this.zoomTo(this.camera().zoom * factor);
  }

  private storeMeasure(id: string, size: FrameSize) {
    const known = this.measured()[id];
    const key = this.cameraKey();

    if (Object.entries(size).every(([side, value]) => known?.[side as keyof FrameSize] === value)) return;

    this.measured.update((measured) => ({ ...measured, [id]: { ...measured[id], ...size } }));
    if (key !== null) this.measure$.next({ cameraKey: key, frameId: id, size });
  }

  private fitted(bounds: Rect, viewport: Size): Camera {
    const gutter = this.layout().rows.length > 0 ? ROW_LABEL_GUTTER : 0;
    const headRoom =
      (this.layout().heads.length > 0 ? COLUMN_HEAD_ROOM : 0) + (this.layout().groups.length > 0 ? GROUP_HEAD_ROOM : 0);
    const camera = fitRect({
      rect: bounds,
      viewport: { width: viewport.width - gutter, height: viewport.height - headRoom },
      padding: FIT_PADDING,
      maxZoom: 1,
    });

    return { ...camera, x: camera.x + gutter, y: camera.y + headRoom };
  }

  private moveCamera(camera: Camera, smooth = false) {
    this.following = false;
    this.smooth.set(smooth);
    this.camera.set(camera);
    this.userCamera$.next(camera);
  }

  private pointerPosition(event: MouseEvent): Point {
    const box = this.host.nativeElement.getBoundingClientRect();

    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  private consumeSwallowedClick() {
    const swallow = this.swallowNextClick;

    this.swallowNextClick = false;

    return swallow;
  }
}
