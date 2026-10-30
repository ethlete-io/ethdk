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
import { CanvasFrame, FrameCrop, cropPointOf, cropRectOf, pagePointOfCrop, placeableFramesOf } from './canvas-frame';
import { CanvasNote, NOTE_BELOW_GAP, noteConnectorPath, noteKeyOf, placeNoteMarkers, placeNotes } from './canvas-note';
import {
  CameraScene,
  CameraTarget,
  cameraAfterWheel,
  cameraFor,
  firstRowBounds,
  shortcutTarget,
} from './canvas-camera';
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
  layoutMatrixSections,
  layoutSheet,
  panCamera,
  rectsIntersect,
  screenToWorld,
  visibleWorldRect,
  zoomAtPoint,
} from './canvas-math';
import { CanvasLine, flowCurveOf, flowLabelRoomOf, layoutFlow } from './flow-layout';
import { CanvasFrameComponent } from './partials/canvas-frame.component';

const SPACING = { columnGap: 40, rowGap: 120 };
const FLOW_SPACING = { columnGap: 280, rowGap: 120, maxColumnGap: 560 };

const sameTops = (a: Record<string, number>, b: Record<string, number>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, top]) => b[key] === top);

let canvasCount = 0;
const FITTED_ROW_GAP = 48;
const GROUP_GAP_FACTOR = 2;
const SECTION_GAP_FACTOR = 4;
const GRID_SPACING = { columnGap: 40, lineWidth: 1600 };
const FALLBACK_WIDTH = 320;
const FALLBACK_HEIGHT = 600;
const FIT_PADDING = 64;
const ROW_LABEL_GUTTER = 160;
const COLUMN_HEAD_ROOM = 64;
const GROUP_HEAD_ROOM = 48;
const ROW_HEAD_HEIGHT = 48;
const ROW_HEAD_GAP = 24;
const MIN_FRAME_ROW_HEIGHT = 64;
const LIVE_MARGIN = 400;
const LIVE_MIN_ZOOM = 0.5;
const LABEL_MIN_ZOOM = 0.25;
const NOTE_MAX_SCALE = 2;
const ZOOM_STEP = 1.5;
const MEASURE_WRITE_MS = 500;

/** Neighbouring columns with the same group `key` share one head above their own; a `switch` there emits `groupSwitch`. */
export type CanvasColumnGroup = {
  key: string;
  label: string;
  note?: string;
  title?: string;
  switch?: { label: string; on: boolean; title?: string };
};

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
  /** The entry of `sections` the column sits in. */
  section?: string;
};

/**
 * A thin row of a `matrix` without frames, whose label is a button that emits `rowToggle`: above the frame
 * row `before` names while `open`, else below every frame row.
 */
export type CanvasRowHead = {
  key: string;
  label: string;
  title?: string;
  /** A muted line inside the row. */
  note?: string;
  open: boolean;
  before?: string;
  /** The entry of `sections` the row sits in. */
  section?: string;
};

type ColumnGroupHead = CanvasColumnGroup & { x: number; y: number; width: number };

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
      'group/canvas relative block h-full touch-none overflow-hidden overscroll-none bg-surface text-text select-none',
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

  public rowHeads = input<CanvasRowHead[]>([]);

  /** Stacks a `matrix` into bands top to bottom, one per key, each with its own column heads; empty for one band. */
  public sections = input<string[]>([]);

  /** Names what the canvas shows. A new key fits the camera again, or restores `restoredCamera`. */
  public cameraKey = input<string | null>(null);

  /** The camera to show instead of a fit, read when `cameraKey` changes. */
  public restoredCamera = input<Camera | null>(null);

  /** What the camera fits when `cameraKey` changes: every frame, or the frames of the top row. */
  public fitTo = input<'all' | 'first row'>('all');

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

  /** The key of a row head the user clicked. */
  public rowToggle = output<string>();

  /** The key of a column group whose switch the user clicked. */
  public groupSwitch = output<string>();

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

  /** By grid frame id, the box of each of its cells from the frame's top left corner. */
  private cellRects = signal<Record<string, Record<string, Rect>>>({});

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
    const spacing = {
      ...SPACING,
      rowGap,
      groupGap: rowGap * GROUP_GAP_FACTOR,
      headGap: ROW_HEAD_GAP,
      minRowHeight: MIN_FRAME_ROW_HEIGHT,
      emptyColumnWidth: FALLBACK_WIDTH,
    };
    const headOf = (head: CanvasRowHead) => ({
      name: head.key,
      height: ROW_HEAD_HEIGHT,
      ...(head.open && head.before !== undefined ? { before: head.before } : {}),
    });
    const emptyWidths = Object.fromEntries(
      columns.flatMap((column) => (column.folded ? [[column.key, column.folded.width]] : [])),
    );
    const below = Object.fromEntries(
      Object.entries(this.noteColumnHeights()).map(([id, height]) => [id, NOTE_BELOW_GAP + height * NOTE_MAX_SCALE]),
    );
    const sections = this.sections();
    const matrix =
      arrangement !== 'matrix'
        ? null
        : sections.length > 0
          ? layoutMatrixSections({
              frames: sized,
              sections: sections.map((section) => ({
                columns: columns.filter((column) => column.section === section).map((column) => column.key),
                heads: this.rowHeads()
                  .filter((head) => head.section === section)
                  .map(headOf),
              })),
              spacing,
              sectionGap: rowGap * SECTION_GAP_FACTOR,
              emptyWidths,
              below,
            })
          : layoutMatrix({
              frames: sized,
              columns: columns.map((column) => column.key),
              spacing,
              heads: this.rowHeads().map(headOf),
              emptyWidths,
              below,
            });
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
      (arrangement === 'grid'
        ? layoutGrid(sized, { ...GRID_SPACING, rowGap, below })
        : layoutSheet(sized, { ...SPACING, below }));
    const heads = (matrix?.columns ?? []).flatMap((placed) => {
      const column = columns.find((candidate) => candidate.key === placed.name);

      return column ? [{ ...column, x: placed.x, y: placed.y ?? 0, width: placed.width }] : [];
    });

    const groups = heads.reduce<ColumnGroupHead[]>((placed, head) => {
      const last = placed.at(-1);

      if (!head.group) return placed;
      if (last?.key === head.group.key)
        return [...placed.slice(0, -1), { ...last, width: head.x + head.width - last.x }];

      return [...placed, { ...head.group, x: head.x, y: head.y, width: head.width }];
    }, []);

    const rowHeads = this.rowHeads();
    const right = Math.max(0, ...heads.map((head) => head.x + head.width));

    return {
      heads,
      groups,
      rows: sheet.rows.filter((row) => row.name !== '' && !row.head),
      rowHeads: sheet.rows.flatMap((row) => {
        const head = row.head ? rowHeads.find((candidate) => candidate.key === row.name) : undefined;

        return head ? [{ ...head, y: row.y, width: right, height: ROW_HEAD_HEIGHT }] : [];
      }),
      frames: sheet.frames.flatMap((placed) => {
        const frame = byId.get(placed.id);

        return frame ? [{ ...placed, frame, unsized: unsized.has(frame.id) }] : [];
      }),
    };
  });

  protected rows = computed(() => this.layout().rows);

  protected placedRowHeads = computed(() => this.layout().rowHeads);

  protected columnHeads = computed(() => this.layout().heads);

  protected groupHeads = computed(() => this.layout().groups);

  protected placedLines = computed(() => {
    const byId = new Map(this.layout().frames.map((placed) => [placed.frame.id, placed]));

    return this.lines().flatMap((line, index) => {
      const from = byId.get(line.from);
      const to = byId.get(line.to);

      return from && to
        ? [
            {
              key: `${index} ${line.from} ${line.to}`,
              label: line.label,
              room: flowLabelRoomOf([from, to], FLOW_SPACING),
              ...flowCurveOf(from, to),
            },
          ]
        : [];
    });
  });

  private bounds = computed(() => {
    const { frames, heads, rowHeads } = this.layout();
    const thin = rowHeads.map((head) => ({ x: 0, y: head.y, width: head.width, height: head.height }));
    const middles = this.placedLines().map(({ middle }) => ({ ...middle, width: 1, height: 1 }));
    const notes = this.notes().flatMap((note) => (note.at ? [{ ...note.at, width: 1, height: 1 }] : []));

    return (
      boundingRect([...frames, ...thin, ...middles, ...notes]) ??
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

  /** The placed frames that take comments: each measured cell of a grid in place of its frame, owned by it. */
  private targets = computed(() => {
    const cellRects = this.cellRects();

    return this.layout().frames.flatMap((placed) => {
      if (!placed.frame.grid) return [{ ...placed, owner: placed.frame.id }];

      const rects = cellRects[placed.frame.id] ?? {};

      return placeableFramesOf([placed.frame]).flatMap((frame) => {
        const rect = rects[frame.id];

        return rect ? [{ ...rect, x: placed.x + rect.x, y: placed.y + rect.y, frame, owner: placed.frame.id }] : [];
      });
    });
  });

  private framesById = computed(() => new Map(this.targets().map((placed) => [placed.frame.id, placed])));

  protected placedPins = computed(() => {
    const byId = this.framesById();
    const openId = this.openPinId();

    return this.pins().flatMap((pin) => {
      const frame = byId.get(pin.frameId);
      const crop = frame?.frame.crop;
      const point = crop && pin.point ? cropPointOf(crop, pin.point) : (pin.point ?? null);

      if (!frame || (pin.point && !point)) return [];

      return [{ pin, x: frame.x + (point?.x ?? frame.width), y: frame.y + (point?.y ?? 0), open: pin.id === openId }];
    });
  });

  protected placedOutlines = computed(() => {
    const byId = this.framesById();

    return this.outlines().flatMap((outline) => {
      const frame = byId.get(outline.frameId);
      const crop = frame?.frame.crop;
      const rect = crop ? cropRectOf(crop, outline) : outline;

      return frame && rect ? [{ ...outline, ...rect, x: frame.x + rect.x, y: frame.y + rect.y }] : [];
    });
  });

  private layoutFramesById = computed(() => new Map(this.layout().frames.map((placed) => [placed.frame.id, placed])));

  protected placedNotes = computed(() =>
    placeNotes(this.notes(), {
      frames: this.framesById(),
      owners: this.layoutFramesById(),
      bounds: boundingRect(this.layout().frames),
    }),
  );

  protected noteMarkers = computed(() =>
    placeNoteMarkers(this.notes(), { frames: this.framesById(), owners: this.layoutFramesById() }),
  );

  protected noteNumbers = computed(() => new Map(this.noteMarkers().map((marker) => [marker.key, marker.number])));

  /** The key of the pointed note whose marker or card the pointer is over; only its line shows. */
  protected hoveredNote = signal<string | null>(null);

  protected readonly NOTE_KEY_OF = noteKeyOf;

  protected placedDraft = computed(() => {
    const draft = this.draft();

    if (draft && 'at' in draft) return draft.at;

    const frame = draft && this.framesById().get(draft.frameId);
    const crop = frame?.frame.crop;
    const point = crop && draft?.point ? cropPointOf(crop, draft.point) : (draft?.point ?? null);

    if (!frame || !draft || (draft.point && !point)) return null;

    return { x: frame.x + (point?.x ?? frame.width), y: frame.y + (point?.y ?? 0) };
  });

  protected pointTargets = computed(() =>
    this.pointing() ? this.targets().filter((placed) => placed.frame.place) : [],
  );

  protected worldTransform = computed(() => {
    const { x, y, zoom } = this.camera();

    return `translate(${x}px, ${y}px) scale(${zoom})`;
  });

  protected labelScale = computed(() => 1 / Math.max(this.camera().zoom, LABEL_MIN_ZOOM));

  /** The scale of the note column below a frame; it stops growing at `NOTE_MAX_SCALE`, the room the layout keeps for it. */
  protected noteScale = computed(() => Math.min(this.labelScale(), NOTE_MAX_SCALE));

  protected notesCompact = computed(() => this.camera().zoom < LABEL_MIN_ZOOM);

  protected noteConnectors = computed(() => {
    if (this.notesCompact()) return [];

    const tops = this.noteCardTops();
    const scale = this.noteScale();

    return this.noteMarkers().flatMap((marker) => {
      const top = marker.key === this.hoveredNote() ? tops[marker.key] : undefined;

      return top === undefined ? [] : [{ key: marker.key, path: noteConnectorPath(marker, { top, scale }) }];
    });
  });

  protected zoomPercent = computed(() => Math.round(this.camera().zoom * 100));

  private panStart$ = new Subject<PointerEvent>();
  private swallowNextClick = false;

  private fittedFor: string | null | undefined = undefined;

  private following: 'all' | 'start' | null = null;

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
        if (this.fittedFor === key) {
          if (this.following) this.camera.set(this.fitted({ bounds, viewport, fit: this.following }));

          return;
        }

        const restored = this.restoredCamera();

        this.fittedFor = key;
        this.following = restored === null ? 'start' : null;
        this.camera.set(restored ?? this.fitted({ bounds, viewport, fit: 'start' }));
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

  protected pickPoint(frame: { id: string; width: number; crop?: FrameCrop }, event: Event) {
    event.stopPropagation();
    if (this.consumeSwallowedClick()) return;
    if (!(event instanceof MouseEvent)) {
      this.pointPick.emit({ frameId: frame.id, point: null });

      return;
    }

    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const scale = box.width / frame.width;

    const point = {
      x: Math.max(0, (event.clientX - box.left) / scale),
      y: Math.max(0, (event.clientY - box.top) / scale),
    };

    this.pointPick.emit({ frameId: frame.id, point: frame.crop ? pagePointOfCrop(frame.crop, point) : point });
  }

  protected pickCaption(frame: CanvasFrame, event: Event) {
    event.stopPropagation();
    if (this.consumeSwallowedClick()) return;
    this.pointPick.emit({ frameId: frame.id, point: null });
  }

  protected toggleRow(key: string, event: MouseEvent) {
    event.stopPropagation();
    this.rowToggle.emit(key);
  }

  protected toggleColumn(key: string, event: MouseEvent) {
    event.stopPropagation();
    this.columnToggle.emit(key);
  }

  protected switchGroup(key: string, event: MouseEvent) {
    event.stopPropagation();
    this.groupSwitch.emit(key);
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
    const placed = this.framesById().get(id);

    if (!placed) return;

    this.selectedId.set(placed.owner);

    const camera = focusRect({ rect: placed, camera: this.camera(), viewport: this.viewport(), padding: FIT_PADDING });

    if (camera) this.moveCamera(camera, true);
  }

  /** Selects a frame and zooms the camera so the frame fills the view. */
  public zoomToFrame(id: string) {
    const placed = this.framesById().get(id);

    if (!placed) return;

    this.selectedId.set(placed.owner);
    this.moveCamera(fitRect({ rect: placed, viewport: this.viewport(), padding: FIT_PADDING }), true);
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

  protected storeCells(id: string, rects: Record<string, Rect>) {
    this.cellRects.update((all) => ({ ...all, [id]: rects }));
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
    this.moveCamera(cameraAfterWheel({ camera: this.camera(), wheel: event, point: this.pointerPosition(event) }));
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

    const target = shortcutTarget(event);

    if (!target) return;

    event.preventDefault();
    this.show(target);
  }

  protected releaseSpace(event: KeyboardEvent) {
    if (event.code === 'Space') this.spaceHeld.set(false);
  }

  /** Fits every frame into view, and keeps fitting as frames report their size until the user moves the camera. */
  public fitAll() {
    const bounds = this.bounds();

    if (bounds) this.moveCamera(this.fitted({ bounds, viewport: this.viewport(), fit: 'all' }), true);
    this.following = 'all';
    this.userCamera$.next(null);
  }

  public fitSelection() {
    this.show({ kind: 'focused' });
  }

  /** Moves the camera to every frame, the selected frame, or the frame nearest the top of the view at a zoom. */
  public show(target: CameraTarget) {
    if (target.kind === 'all') {
      this.fitAll();

      return;
    }

    const camera = cameraFor(target, this.scene(this.bounds(), this.viewport()));

    if (camera) this.moveCamera(camera, true);
  }

  public zoomTo(zoom: number) {
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

  private fitted({ bounds, viewport, fit }: { bounds: Rect; viewport: Size; fit: 'all' | 'start' }): Camera {
    const firstRow =
      fit === 'start' && this.fitTo() === 'first row'
        ? firstRowBounds(
            this.layout().frames.map(({ x, y, width, height, frame }) => ({ x, y, width, height, row: frame.row })),
          )
        : null;

    return cameraFor({ kind: 'all' }, this.scene(firstRow ?? bounds, viewport)) ?? this.camera();
  }

  private scene(bounds: Rect | null, viewport: Size): CameraScene {
    const layout = this.layout();
    const frames = this.placedFrames();

    return {
      camera: this.camera(),
      viewport,
      frames,
      focused: frames.find((placed) => placed.selected) ?? null,
      bounds,
      padding: FIT_PADDING,
      inset: {
        left: layout.rows.length + layout.rowHeads.length > 0 ? ROW_LABEL_GUTTER : 0,
        top: (layout.heads.length > 0 ? COLUMN_HEAD_ROOM : 0) + (layout.groups.length > 0 ? GROUP_HEAD_ROOM : 0),
      },
    };
  }

  private moveCamera(camera: Camera, smooth = false) {
    this.following = null;
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
