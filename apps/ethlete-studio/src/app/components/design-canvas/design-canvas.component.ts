import {
  afterRenderEffect,
  booleanAttribute,
  Component,
  contentChildren,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS, FocusRingDirective } from '@ethlete/components';
import { dragGestureFrom, signalElementDimensions } from '@ethlete/core';
import { EMPTY, Subject, buffer, debounceTime, exhaustMap, switchMap, tap, timer } from 'rxjs';
import { frameSizesOf, frameSizesWith, rememberView, rememberedView, FrameSize } from '../../studio-view/remembered';
import { CanvasFrameDirective } from './canvas-frame.directive';
import { CanvasFrame, cropPointOf, cropRectOf, placeableFramesOf, schemeBoxOf } from './canvas-frame';
import {
  CameraScene,
  CameraTarget,
  cameraAfterWheel,
  cameraFor,
  inUncoveredView,
  shortcutTarget,
  uncoveredCentre,
  UncoveredView,
} from './canvas-camera';
import { CanvasPin, FrameOutline } from './canvas-pin';
import {
  Camera,
  Point,
  Rect,
  Size,
  areasInView,
  boundingRect,
  fitRect,
  focusRect,
  sameRect,
  layoutGrid,
  layoutMatrix,
  layoutMatrixSections,
  layoutSheet,
  panCamera,
  zoomAtPoint,
} from './canvas-math';
import { keptLiveIds, liveIdsOf, sameIds } from './live-frames';
import { CanvasFrameComponent } from './partials/canvas-frame.component';
import { CommentPinComponent } from '../../design-parts/comment-pin/comment-pin.component';
import { ZoomChipComponent } from '../../design-parts/zoom-chip/zoom-chip.component';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

const SPACING = { columnGap: 40, rowGap: 120 };

const cellAt = (event: MouseEvent) => {
  const frame = event.currentTarget;

  if (!(frame instanceof HTMLElement)) return undefined;

  return frame.ownerDocument
    .elementsFromPoint(event.clientX, event.clientY)
    .find(
      (target): target is HTMLElement =>
        target instanceof HTMLElement && 'cellId' in target.dataset && frame.contains(target),
    );
};

const FITTED_ROW_GAP = 48;
const GROUP_GAP_FACTOR = 2;
const SECTION_GAP_FACTOR = 4;
const GRID_SPACING = { columnGap: 40, lineWidth: 1600 };
const FALLBACK_WIDTH = 320;
const FALLBACK_HEIGHT = 600;
const FIT_PADDING = 64;
const START_PADDING = { x: 40, y: 48 };
const ROW_HEAD_GUTTER = 160;
const COLUMN_HEAD_ROOM = 64;
const GROUP_HEAD_ROOM = 48;
const ROW_HEAD_HEIGHT = 48;
const ROW_HEAD_GAP = 24;
/** A row head label stops growing here: at about 32px high it still fits the head height plus its gap, so heads never overlap. */
const ROW_HEAD_MAX_SCALE = 2;
const MIN_FRAME_ROW_HEIGHT = 64;
const LIVE_MARGIN = 400;
const LIVE_MIN_ZOOM = 0.5;
const LIVE_REST_MS = 250;
const LIVE_GRACE_MS = 5000;
const MAX_LIVE_FRAMES = 6;
const LABEL_MIN_ZOOM = 0.25;
const ZOOM_STEP = 1.5;
const MEASURE_WRITE_MS = 500;
const DRAG_THRESHOLD = 4;
const ARROW_STEP = 80;

const ARROWS: Record<string, Point> = {
  ArrowLeft: { x: ARROW_STEP, y: 0 },
  ArrowRight: { x: -ARROW_STEP, y: 0 },
  ArrowUp: { x: 0, y: ARROW_STEP },
  ArrowDown: { x: 0, y: -ARROW_STEP },
};

const padded = (rect: Rect, by: number): Rect => ({
  x: rect.x - by,
  y: rect.y - by,
  width: rect.width + by * 2,
  height: rect.height + by * 2,
});

const offsetIn = (element: HTMLElement, world: HTMLElement): Rect => {
  let x = 0;
  let y = 0;

  for (let at: HTMLElement | null = element; at && at !== world; at = at.offsetParent as HTMLElement | null) {
    x += at.offsetLeft;
    y += at.offsetTop;
  }

  return { x, y, width: element.offsetWidth, height: element.offsetHeight };
};

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

export type CanvasOpening = 'start' | 'all' | 'visible';

type ColumnGroupHead = CanvasColumnGroup & { x: number; y: number; width: number };

type PlacedFrame = Rect & {
  frame: CanvasFrame;
  page: Size;
  unsized: boolean;
  live: boolean;
  liveCells: ReadonlySet<string> | null;
  active: boolean;
  selected: boolean;
};

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

const INTERACTIVE =
  'button, a[href], input, select, textarea, summary, [contenteditable], [role="button"], [role="option"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="link"], [role="treeitem"]';

const isInteractive = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;

  for (let element: Element | null = target; element; element = element.parentElement) {
    if (isEditable(element) || element.matches(INTERACTIVE) || element.localName.startsWith('et-')) return true;
  }

  return false;
};

@Component({
  selector: 'ethlete-design-canvas',
  templateUrl: './design-canvas.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, CanvasFrameComponent, CommentPinComponent, ZoomChipComponent],
  hostDirectives: [FocusRingDirective],
  host: {
    class:
      'group/canvas relative block h-full touch-none overscroll-none text-text transition-[outline-color] duration-(--duration-state) ease-(--ease-standard) select-none [--_et-focus-ring-offset:-2px] data-pointer-focus:outline-transparent',
    tabindex: '0',
    'aria-label': STUDIO_LABELS.canvas.label,
    '[class.overflow-hidden]': 'clip()',
    '[class.cursor-grab]': 'spaceHeld() && !panning()',
    '[class.cursor-grabbing]': 'panning()',
    '[attr.data-dragging]': '(spaceHeld() || panning()) || null',
    '[attr.data-pointer-focus]': 'pointerFocus() || null',
    '(blur)': 'pointerFocus.set(false)',
    '(wheel)': 'moveCameraByWheel($event)',
    '(pointerdown)': 'startPan($event)',
    '(click)': 'clickCanvas($event)',
    '(dblclick)': 'focusProjectedFrame($event)',
    '(window:keydown)': 'handleShortcut($event)',
    '(window:keyup)': 'releaseSpace($event)',
    '(window:blur)': 'spaceHeld.set(false)',
  },
})
export class DesignCanvasComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  public frames = input<CanvasFrame[]>([]);

  /**
   * `sheet` puts each row of frames on its own line; `grid` flows the frames as tiles with their label below;
   * `matrix` puts each frame at its row and its `column`, with a head over each of `columns`.
   */
  public arrangement = input<'sheet' | 'grid' | 'matrix'>('sheet');

  /** The columns of a `matrix`, in order. A column without frames still gets its head. */
  public columns = input<CanvasColumn[]>([]);

  public rowHeads = input<CanvasRowHead[]>([]);

  /** Stacks a `matrix` into bands top to bottom, one per key, each with its own column heads; empty for one band. */
  public sections = input<string[]>([]);

  /** Names what the canvas shows. A new key opens the camera at 100 % on the first frames, or restores `restoredCamera`. */
  public cameraKey = input<string | null>(null);

  /** The camera to show instead of the opening view, read when `cameraKey` changes. */
  public restoredCamera = input<Camera | null>(null);

  public zoomChipClass = input('absolute right-3 bottom-3');

  public zoomChip = input(true, { transform: booleanAttribute });

  public align = input<'center' | 'start'>('center');

  public fitPadding = input(FIT_PADDING);

  /** World pixels kept around each projected frame, so an outline drawn past its edge stays in view. */
  public frameOutline = input(0);

  /** The camera a new `cameraKey` opens at without a `restoredCamera`: 100 % at the first frames, every frame fitted, or 100 % at the frame the fit shows nearest the top centre. */
  public opening = input<CanvasOpening>('start');

  /** Whether the shell's side panel floats over the canvas's left edge, so camera commands keep clear of it. */
  public coveredByShell = input(true, { transform: booleanAttribute });

  public smoothCamera = input(true, { transform: booleanAttribute });

  public clip = input(true, { transform: booleanAttribute });

  public pins = input<CanvasPin[]>([]);

  public outlines = input<FrameOutline[]>([]);

  /** The camera after the user moved it and it came to rest; `null` after a fit, so a reload fits again. */
  public cameraChange = output<Camera | null>();

  /** The key of a folded column or of a column group whose head the user clicked. */
  public columnToggle = output<string>();

  /** The key of a row head the user clicked. */
  public rowToggle = output<string>();

  /** The key of a column group whose switch the user clicked. */
  public groupSwitch = output<string>();

  private frameViews = viewChildren(CanvasFrameComponent);

  /** Frames the page projects into the world instead of `frames`, each marked with `ethleteCanvasFrame`. */
  private projected = contentChildren(CanvasFrameDirective, { descendants: true });
  private shellInsetProbe = viewChild.required<ElementRef<HTMLElement>>('shellInsetProbe');
  private world = viewChild.required<ElementRef<HTMLElement>>('world');

  public projectedRects = signal<Rect[]>([], {
    equal: (a, b) =>
      a.length === b.length &&
      a.every((rect, index) => {
        const other = b[index];

        return (
          !!other &&
          rect.x === other.x &&
          rect.y === other.y &&
          rect.width === other.width &&
          rect.height === other.height
        );
      }),
  });

  private selectedProjected = signal<CanvasFrameDirective | null>(null);
  private projectedWorld = signal<Rect>(
    { x: 0, y: 0, width: 0, height: 0 },
    { equal: (a, b) => a.width === b.width && a.height === b.height },
  );
  public camera = signal<Camera>({ x: 0, y: 0, zoom: 1 });
  public openPinId = signal<string | null>(null);
  protected smooth = signal(false);
  public selectedId = signal<string | null>(null);
  public selectedCellId = linkedSignal<string | null, string | null>({
    source: this.selectedId,
    computation: () => null,
  });
  public activeId = signal<string | null>(null);
  protected spaceHeld = signal(false);
  protected panning = signal(false);
  protected pointerFocus = signal(false);
  private measured = linkedSignal<string | null, Record<string, FrameSize>>({
    source: this.cameraKey,
    computation: (key) => (key === null ? {} : frameSizesOf(rememberedView().measuredSizes ?? {}, key)),
  });
  private measure$ = new Subject<{ cameraKey: string; frameId: string; size: FrameSize }>();

  private userCamera$ = new Subject<Camera | null>();
  private dimensions = signalElementDimensions(this.host);
  private viewport = computed<Size>(() => this.dimensions().client ?? { width: 0, height: 0 });
  private shellInset = signalElementDimensions(this.shellInsetProbe);
  private covered = computed(() => (this.coveredByShell() ? (this.shellInset().offset?.width ?? 0) : 0));

  /** By grid frame id, the box of each of its cells from the frame's top left corner. */
  private cellRects = signal<Record<string, Record<string, Rect>>>({});

  protected worldTransform = computed(() => {
    const { x, y, zoom } = this.camera();

    return `translate(${x}px, ${y}px) scale(${zoom})`;
  });

  protected labelScale = computed(() => 1 / Math.max(this.camera().zoom, LABEL_MIN_ZOOM));

  protected rowHeadScale = computed(() => Math.min(this.labelScale(), ROW_HEAD_MAX_SCALE));

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
    const pages = new Map<string, Size>();
    const sized = frames.map((frame) => {
      const { width, height } =
        frame.empty === undefined ? known(frame) : { width: rowMax(frame, 'width'), height: rowMax(frame, 'height') };
      const page = { width: width ?? FALLBACK_WIDTH, height: height ?? FALLBACK_HEIGHT };
      const box = schemeBoxOf(frame, page);

      pages.set(frame.id, page);

      return {
        id: frame.id,
        row: frame.row ?? '',
        ...(frame.rowGroup === undefined ? {} : { rowGroup: frame.rowGroup }),
        column: frame.column ?? '',
        fitted: frame.width === undefined,
        ...box,
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
            })
          : layoutMatrix({
              frames: sized,
              columns: columns.map((column) => column.key),
              spacing,
              heads: this.rowHeads().map(headOf),
              emptyWidths,
            });
    const sheet =
      matrix ?? (arrangement === 'grid' ? layoutGrid(sized, { ...GRID_SPACING, rowGap }) : layoutSheet(sized, SPACING));
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
      rowHeads: sheet.rows.flatMap((row) => {
        const head = row.head ? rowHeads.find((candidate) => candidate.key === row.name) : undefined;

        return head ? [{ ...head, y: row.y, width: right, height: ROW_HEAD_HEIGHT }] : [];
      }),
      frames: sheet.frames.flatMap((placed) => {
        const frame = byId.get(placed.id);

        return frame ? [{ ...placed, frame, page: pages.get(frame.id) ?? placed, unsized: unsized.has(frame.id) }] : [];
      }),
    };
  });

  protected placedRowHeads = computed(() => this.layout().rowHeads);

  protected columnHeads = computed(() => this.layout().heads);

  protected groupHeads = computed(() => this.layout().groups);

  private projectedScene = computed(() => {
    const outline = this.frameOutline();
    const rects = this.projectedRects().map((rect) => padded(rect, outline));
    const selected = this.selectedProjected();
    const index = selected ? this.projected().indexOf(selected) : -1;

    return { frames: rects, focused: rects[index] ?? null };
  });

  private bounds = computed(() => {
    if (this.projected().length > 0) return padded(this.projectedWorld(), this.frameOutline());

    const { frames, heads, rowHeads } = this.layout();
    const thin = rowHeads.map((head) => ({ x: 0, y: head.y, width: head.width, height: head.height }));

    return (
      boundingRect([...frames, ...thin]) ??
      boundingRect(heads.map((head) => ({ x: head.x, y: 0, width: head.width, height: 1 })))
    );
  });

  private restedCamera = toSignal(toObservable(this.camera).pipe(debounceTime(LIVE_REST_MS)), { initialValue: null });

  private liveIds = signal<ReadonlySet<string>>(new Set(), { equal: sameIds });

  protected placedFrames = computed<PlacedFrame[]>(() => {
    const liveIds = this.liveIds();
    const activeId = this.activeId();
    const selectedId = this.selectedId();

    return this.layout().frames.map(({ x, y, width, height, frame, page, unsized }) => ({
      x,
      y,
      width,
      height,
      frame,
      page,
      unsized,
      active: frame.id === activeId,
      selected: frame.id === selectedId,
      live: frame.id === activeId || liveIds.has(frame.id) || !!frame.grid?.cells.some((cell) => liveIds.has(cell.id)),
      liveCells: frame.id === activeId ? null : liveIds,
    }));
  });

  /** The placed frames that take comments: each measured cell of a grid in place of its frame, owned by it. */
  private targets = computed(() => {
    const cellRects = this.cellRects();

    return this.layout().frames.flatMap((placed) => {
      if (!placed.frame.grid) return [{ ...placed, ...placed.page, owner: placed.frame.id }];

      const rects = cellRects[placed.frame.id] ?? {};

      return placeableFramesOf([placed.frame]).flatMap((frame) => {
        const rect = rects[frame.id];

        return rect ? [{ ...rect, x: placed.x + rect.x, y: placed.y + rect.y, frame, owner: placed.frame.id }] : [];
      });
    });
  });

  private wantedLiveIds = computed<ReadonlySet<string>>(
    () => {
      const camera = this.restedCamera();

      if (!camera || camera.zoom < LIVE_MIN_ZOOM) return new Set();

      return liveIdsOf({
        candidates: this.targets().map(({ x, y, width, height, frame }) => ({
          x,
          y,
          width,
          height,
          id: frame.id,
          drawn: !!frame.screenshot,
        })),
        camera,
        viewport: this.viewport(),
        margin: LIVE_MARGIN,
        max: MAX_LIVE_FRAMES,
      });
    },
    { equal: sameIds },
  );

  private framesById = computed(() => new Map(this.targets().map((placed) => [placed.frame.id, placed])));

  /** By frame id, the world area of each frame the viewport shows once the camera rests. */
  public frameAreasInView = computed(() =>
    areasInView({
      rects: this.layout().frames.map(({ x, y, width, height, frame }) => ({ x, y, width, height, id: frame.id })),
      camera: this.restedCamera() ?? this.camera(),
      viewport: this.viewport(),
    }),
  );

  protected placedPins = computed(() => {
    const byId = this.framesById();
    const openId = this.openPinId();

    return this.pins().flatMap((pin) => {
      const frame = byId.get(pin.frameId);
      const crop = frame?.frame.crop;
      const point = crop && pin.point ? cropPointOf(crop, pin.point) : (pin.point ?? null);

      if (!frame) return [];

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

  protected zoomPercent = computed(() => Math.round(this.camera().zoom * 100));

  private panStart$ = new Subject<{ event: PointerEvent; threshold: number }>();
  private swallowNextClick = false;

  private fittedFor: string | null | undefined = undefined;

  private coveredAtFit = 0;

  private following: CanvasOpening | { frame: string } | null = null;

  private followsResize = false;

  private followedBounds: Rect | null = null;

  private hostLeft = 0;

  protected readonly ZOOM_STEP = ZOOM_STEP;

  constructor() {
    effect(() => {
      const bounds = this.bounds();
      const viewport = this.viewport();
      const key = this.cameraKey();
      const covered = this.covered();

      if (!bounds || viewport.width === 0 || viewport.height === 0) return;

      untracked(() => {
        const hostLeft = this.host.nativeElement.getBoundingClientRect().left;
        const shift = this.hostLeft - hostLeft;

        this.hostLeft = hostLeft;

        if (this.fittedFor === key) {
          if (shift !== 0) this.camera.update((camera) => ({ ...camera, x: camera.x + shift }));

          if (covered !== this.coveredAtFit) {
            this.coveredAtFit = covered;
            this.following = null;

            return;
          }

          if (!this.followsResize && sameRect(bounds, this.followedBounds)) return;

          this.followedBounds = bounds;

          const camera = this.following && this.followedCamera({ bounds, viewport, following: this.following });

          if (camera) this.camera.set(camera);

          return;
        }

        const restored = this.restoredCamera();

        this.fittedFor = key;
        this.coveredAtFit = covered;
        this.following = restored === null ? this.opening() : null;
        this.followsResize = false;
        this.followedBounds = bounds;
        this.camera.set(restored ?? this.fitted({ bounds, viewport, fit: this.opening() }));
      });
    });

    afterRenderEffect(() => {
      const frames = this.projected();
      const world = this.world().nativeElement;

      this.viewport();
      this.projectedRects.set(frames.map((frame) => offsetIn(frame.elementRef.nativeElement, world)));
      this.projectedWorld.set({ x: 0, y: 0, width: world.offsetWidth, height: world.offsetHeight });
    });

    effect(() => {
      const selected = this.selectedProjected();

      for (const frame of this.projected()) frame.selected.set(frame === selected);
    });

    toObservable(this.wantedLiveIds)
      .pipe(
        switchMap((wanted) => {
          const kept = keptLiveIds({ wanted, live: this.liveIds(), max: MAX_LIVE_FRAMES });

          this.liveIds.set(kept);

          return kept.size > wanted.size ? timer(LIVE_GRACE_MS).pipe(tap(() => this.liveIds.set(wanted))) : EMPTY;
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

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
        exhaustMap(({ event, threshold }) =>
          dragGestureFrom(event, this.host.nativeElement, { commitThreshold: threshold }),
        ),
        tap((gesture) => {
          if (gesture.type === 'start') this.swallowNextClick = true;
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
    const cell =
      event
        .composedPath()
        .find((target): target is HTMLElement => target instanceof HTMLElement && 'cellId' in target.dataset) ??
      cellAt(event);

    this.selectedCellId.set(cell?.dataset['cellId'] ?? null);
    if (this.activeId() !== id) this.activeId.set(null);
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

  protected togglePin(id: string) {
    this.openPinId.set(this.openPinId() === id ? null : id);
  }

  /** Opens a pin's text and moves the camera to its frame. */
  /** The window of the frame or grid cell `id` once its live page painted; `null` before. */
  public liveWindowOf(id: string) {
    const views = this.frameViews();
    const own = views.find((view) => view.frame().id === id);

    if (own) return own.liveWindow();

    return views.find((view) => view.frame().grid?.cells.some((cell) => cell.id === id))?.liveCellWindowOf(id) ?? null;
  }

  public openPin(id: string) {
    const pin = this.pins().find((candidate) => candidate.id === id);

    this.openPinId.set(pin ? id : null);
    if (pin) this.focusFrame(pin.frameId);
  }

  /** Selects a frame and moves the camera to it, and keeps it in view as the canvas resizes until the user moves the camera. */
  public focusFrame(id: string) {
    const placed = this.framesById().get(id);

    if (!placed) return;

    this.selectedId.set(placed.owner);
    this.selectedCellId.set(placed.owner === id ? null : id);

    const camera = this.inView(this.viewport(), (view) => focusRect({ rect: placed, ...view, padding: FIT_PADDING }));

    if (camera) this.moveCamera(camera, true);
    this.following = { frame: id };
    this.followsResize = true;
  }

  /** Selects a frame and zooms the camera so the frame fills the view. */
  public zoomToFrame(id: string) {
    const placed = this.framesById().get(id);

    if (!placed) return;

    this.selectedId.set(placed.owner);
    this.selectedCellId.set(placed.owner === id ? null : id);
    this.moveCamera(
      this.inView(this.viewport(), ({ viewport }) => fitRect({ rect: placed, viewport, padding: FIT_PADDING })),
      true,
    );
  }

  /** Makes the frame `id` live and active, as a double click on it does; a grid cell's `id` makes its grid frame live. */
  public activate(id: string) {
    const frame = this.frames().find(
      (candidate) => candidate.id === id || candidate.grid?.cells.some((cell) => cell.id === id),
    );

    if (!frame || frame.empty !== undefined) return;

    this.selectedId.set(frame.id);
    this.activeId.set(frame.id);
  }

  protected leaveActiveFrame() {
    this.activeId.set(null);
  }

  protected clickCanvas(event: MouseEvent) {
    if (this.consumeSwallowedClick()) return;

    const frame = this.projectedFrameOf(event.target);

    if (frame) {
      this.selectedProjected.set(frame);

      return;
    }

    if (isInteractive(event.target)) return;
    this.openPinId.set(null);
    this.selectedId.set(null);
    this.selectedProjected.set(null);
    this.activeId.set(null);
  }

  protected focusProjectedFrame(event: MouseEvent) {
    const frame = this.projectedFrameOf(event.target);

    if (!frame) return;

    this.selectedProjected.set(frame);
    this.show({ kind: 'focused' });
  }

  protected activateAndFocus(id: string) {
    this.activate(id);
    this.show({ kind: 'focused' });
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
    const spaced = event.button === 0 && this.spaceHeld();

    if (event.button === 0 && !isInteractive(event.target)) this.pointerFocus.set(true);
    if (!middle && !spaced && (event.button !== 0 || isInteractive(event.target))) return;

    if (middle || spaced) event.preventDefault();
    this.swallowNextClick = spaced;
    this.panStart$.next({ event, threshold: middle || spaced ? 0 : DRAG_THRESHOLD });
  }

  protected moveCameraByWheel(event: WheelEvent) {
    event.preventDefault();
    this.moveCamera(cameraAfterWheel({ camera: this.camera(), wheel: event, point: this.pointerPosition(event) }));
  }

  protected handleShortcut(event: KeyboardEvent) {
    if (isEditable(event.target)) return;

    if (event.code === 'Space') {
      if (isInteractive(event.target)) return;

      event.preventDefault();
      this.spaceHeld.set(true);

      return;
    }

    if (event.key === 'Escape') {
      if (this.openPinId()) this.openPinId.set(null);
      else if (this.activeId()) this.leaveActiveFrame();
      else {
        this.selectedId.set(null);
        this.selectedProjected.set(null);
      }

      return;
    }

    const arrow = ARROWS[event.code];

    if (arrow && event.target instanceof Node && this.host.nativeElement.contains(event.target)) {
      if (isInteractive(event.target) && event.target !== this.host.nativeElement) return;

      event.preventDefault();
      this.moveCamera(panCamera(this.camera(), arrow));

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
    this.followsResize = true;
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
    const point = uncoveredCentre({ viewport: this.viewport(), covered: this.covered() });

    this.moveCamera(zoomAtPoint({ camera: this.camera(), point, zoom }), true);
  }

  protected resetZoom() {
    const bounds = this.bounds();

    if (bounds) this.moveCamera(this.openingCamera(bounds), true);
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

  private followedCamera({
    bounds,
    viewport,
    following,
  }: {
    bounds: Rect;
    viewport: Size;
    following: CanvasOpening | { frame: string };
  }): Camera | null {
    if (typeof following === 'string') return this.fitted({ bounds, viewport, fit: following });

    const placed = this.framesById().get(following.frame);

    return placed ? this.inView(viewport, (view) => focusRect({ rect: placed, ...view, padding: FIT_PADDING })) : null;
  }

  private fitted({ bounds, viewport, fit }: { bounds: Rect; viewport: Size; fit: CanvasOpening }): Camera {
    if (fit === 'start') return this.openingCamera(bounds);

    const scene = this.scene(bounds, viewport);
    const all = cameraFor({ kind: 'all' }, scene) ?? this.camera();

    if (fit === 'all') return all;

    return cameraFor({ kind: 'visible', zoom: 1 }, { ...scene, camera: all }) ?? all;
  }

  private openingCamera(bounds: Rect): Camera {
    const { inset } = this.scene(bounds, this.viewport());

    return {
      zoom: 1,
      x: this.covered() + (inset?.left ?? 0) + START_PADDING.x - bounds.x,
      y: (inset?.top ?? 0) + START_PADDING.y - bounds.y,
    };
  }

  private scene(bounds: Rect | null, viewport: Size): CameraScene {
    const layout = this.layout();
    const frames = this.placedFrames();
    const projected = this.projected().length > 0 ? this.projectedScene() : null;

    return {
      camera: this.camera(),
      viewport,
      frames: projected?.frames ?? frames,
      focused: projected ? projected.focused : (frames.find((placed) => placed.selected) ?? null),
      bounds,
      padding: this.fitPadding(),
      align: this.align(),
      covered: this.covered(),
      inset: {
        left: layout.rowHeads.length > 0 ? ROW_HEAD_GUTTER : 0,
        top: (layout.heads.length > 0 ? COLUMN_HEAD_ROOM : 0) + (layout.groups.length > 0 ? GROUP_HEAD_ROOM : 0),
      },
    };
  }

  private inView<T extends Camera | null>(viewport: Size, command: (view: UncoveredView) => T): T {
    return inUncoveredView({ camera: this.camera(), viewport, covered: this.covered() }, command);
  }

  private moveCamera(camera: Camera, smooth = false) {
    this.following = null;
    this.smooth.set(smooth && this.smoothCamera());
    this.camera.set(camera);
    this.userCamera$.next(camera);
  }

  private pointerPosition(event: MouseEvent): Point {
    const box = this.host.nativeElement.getBoundingClientRect();

    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  private projectedFrameOf(target: EventTarget | null) {
    return target instanceof Node
      ? (this.projected().find((frame) => frame.elementRef.nativeElement.contains(target)) ?? null)
      : null;
  }

  private consumeSwallowedClick() {
    const swallow = this.swallowNextClick;

    this.swallowNextClick = false;

    return swallow;
  }
}
