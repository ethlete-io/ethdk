import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  contentChildren,
  ElementRef,
  InjectionToken,
  TemplateRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS, FocusRingDirective, TOOLTIP_IMPORTS } from '@ethlete/components';
import { dragGestureFrom, signalElementDimensions } from '@ethlete/core';
import {
  EMPTY,
  Subject,
  buffer,
  debounceTime,
  exhaustMap,
  finalize,
  map,
  startWith,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { frameSizesOf, frameSizesWith, rememberView, rememberedView, FrameSize } from '../../studio-view/remembered';
import { CanvasFrameDirective } from './canvas-frame.directive';
import { CanvasFrame, FrameCrop, cropPointOf, pagePointOfCrop, placeableFramesOf, schemeBoxOf } from './canvas-frame';
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
import { CanvasPin, FramePoint } from './canvas-pin';
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
  layoutSheet,
  offsetWithin,
  panCamera,
  rectsIntersect,
  visibleWorldRect,
  zoomAtPoint,
} from './canvas-math';
import { keptLiveIds, liveIdsOf, sameIds } from './live-frames';
import { leavesWindow } from './pointer-focus';
import { CanvasFrameComponent } from './partials/canvas-frame.component';
import { SHOT_FETCH_PRIORITY } from './partials/shot-rank';
import { canvasLabelScale } from '../../design-parts/canvas-frames/canvas-frames-geometry';
import { CommentPinComponent } from '../../design-parts/comment-pin/comment-pin.component';
import { CommentTargetComponent } from '../../design-parts/comment-target/comment-target.component';
import { ZoomChipComponent } from '../../design-parts/zoom-chip/zoom-chip.component';
import { CANVAS_LABELS } from '../../i18n/canvas-labels';

const SPACING = { columnGap: 40, rowGap: 120 };
const MATRIX_COLUMN_GAP = 80;

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
const GRID_SPACING = { columnGap: 40, lineWidth: 1600 };
const FALLBACK_WIDTH = 320;
const FALLBACK_HEIGHT = 600;
const FIT_PADDING = 64;
const START_PADDING = { x: 40, y: 48 };
const CAPTION_ROOM = 40;
const COLUMN_HEAD_ROOM = 64;
const GROUP_HEAD_ROOM = 48;
const ROW_HEAD_ROOM = 600;
const MIN_FRAME_ROW_HEIGHT = 64;
const LIVE_MARGIN = 400;
const LIVE_MIN_ZOOM = 0.5;
/** How long the camera rests before the frames in view load their live pages. */
export const CANVAS_LIVE_REST_MS = new InjectionToken<number>('CANVAS_LIVE_REST_MS', { factory: () => 250 });
const WHEEL_GESTURE_GAP_MS = 200;
const LIVE_GRACE_MS = 5000;
const MAX_LIVE_FRAMES = 6;
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

const offsetIn = (element: HTMLElement, world: HTMLElement): Rect => ({
  ...offsetWithin(element, world),
  width: element.offsetWidth,
  height: element.offsetHeight,
});

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
  imports: [
    NgTemplateOutlet,
    BUTTON_IMPORTS,
    CanvasFrameComponent,
    CommentPinComponent,
    CommentTargetComponent,
    ZoomChipComponent,
    TOOLTIP_IMPORTS,
  ],
  providers: [
    {
      provide: SHOT_FETCH_PRIORITY,
      useFactory: () => {
        const canvas = inject(DesignCanvasComponent);

        return canvas.shotPriority;
      },
    },
  ],
  hostDirectives: [FocusRingDirective],
  host: {
    class:
      'group/canvas relative isolate block overflow-hidden contain-paint h-full touch-none overscroll-none text-text transition-[outline-color] duration-(--duration-state) ease-(--ease-standard) select-none [--et-focus-ring-offset:-2px] data-pointer-focus:outline-transparent',
    tabindex: '0',
    'aria-label': CANVAS_LABELS.label,
    '[class.cursor-grab]': 'spaceHeld() && !panning()',
    '[class.cursor-grabbing]': 'panning()',
    '[attr.data-dragging]': '(spaceHeld() || panning()) || null',
    '[attr.data-wheeling]': 'wheeling() || null',
    '[attr.data-pointer-focus]': 'pointerFocus() || null',
    '(blur)': 'clearPointerFocus()',
    '(wheel)': 'moveCameraByWheel($event)',
    '(pointerdown)': 'startPan($event)',
    '(click)': 'clickCanvas($event)',
    '(window:keydown)': 'handleShortcut($event)',
    '(window:keyup)': 'releaseSpace($event)',
    '(lostpointercapture)': 'panEnd$.next()',
    '(window:blur)': 'spaceHeld.set(false); panEnd$.next()',
    '(document:visibilitychange)': 'panEnd$.next()',
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

  /** Names what the canvas shows. A new key opens the camera at 100 % on the first frames, or restores `restoredCamera`. */
  public cameraKey = input<string | null>(null);

  /** The camera to show instead of the opening view, read when `cameraKey` changes. */
  public restoredCamera = input<Camera | null>(null);

  /** Where a key without a restored camera opens: `'all'` fits every frame, `'start'` shows the first frames at 100 %. */
  public opening = input<'all' | 'start'>('all');

  /** Where the world's top left corner opens at 100 %, in canvas pixels; `null` opens the first frames past the covered edge. */
  public origin = input<Point | null>(null);

  public zoomChipClass = input('absolute right-3 bottom-3');

  public pins = input<CanvasPin[]>([]);

  /** While on, every frame that has a `place` is a target, and a click on it reports the point through `pointPick`. */
  public pointing = input(false);

  /** The title of a target, from the frame's label. */

  /** Where the projected `[canvasDraft]` content sits, on a frame; `null` hides it. */
  public draft = input<FramePoint | null>(null);

  /**
   * What the open pin shows beside it: `undefined` its comment text, a template that card in place of the text,
   * `null` nothing. With a card set, a pin click reports through `pinPick` instead of toggling the pin.
   */
  public pinCard = input<TemplateRef<unknown> | null | undefined>(undefined);

  public selectedId = model<string | null>(null);

  public activeId = model<string | null>(null);

  public pointPick = output<FramePoint>();

  /** The pin a click opened, or `null` when a click or Esc closed the open pin. */
  public pinPick = output<string | null>();

  /** The camera after the user moved it and it came to rest; `null` after a fit, so a reload fits again. */
  public cameraChange = output<Camera | null>();

  /** The key of a folded column or of a column group whose head the user clicked. */
  public columnToggle = output<string>();

  /** The key of a row head the user clicked. */
  /** The key of a column group whose switch the user clicked. */
  public groupSwitch = output<string>();

  /** The id of a frame whose failed page the user reloads. */
  public reload = output<string>();

  private frameViews = viewChildren(CanvasFrameComponent);

  /** Frames the page projects into the world instead of `frames`, each marked with `ethleteCanvasFrame`. */
  private projected = contentChildren(CanvasFrameDirective, { descendants: true });
  private shellInsetProbe = viewChild.required<ElementRef<HTMLElement>>('shellInsetProbe');
  private actionsProbe = viewChild.required<ElementRef<HTMLElement>>('actionsProbe');
  private world = viewChild.required<ElementRef<HTMLElement>>('world');

  private keyShown = linkedSignal<string | null, { seen: boolean; switched: boolean }>({
    source: this.cameraKey,
    computation: (key, previous) => ({
      seen: key !== null || !!previous?.value.seen,
      switched: key !== null && !!previous?.value.seen,
    }),
  });

  /** `high` after a switch to another key, so the pictures of the frames switched to all load at once; the first view keeps the browser's own order. */
  public shotPriority = computed(() => (this.keyShown().switched ? 'high' : null));
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
  public selectedCellId = linkedSignal<string | null, string | null>({
    source: this.selectedId,
    computation: () => null,
  });
  protected spaceHeld = signal(false);
  protected panning = signal(false);

  protected panEnd$ = new Subject<void>();
  private wheel$ = new Subject<void>();
  protected wheeling = toSignal(
    this.wheel$.pipe(
      switchMap(() =>
        timer(WHEEL_GESTURE_GAP_MS).pipe(
          map(() => false),
          startWith(true),
        ),
      ),
    ),
    { initialValue: false },
  );
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
  private covered = computed(() => this.shellInset().offset?.width ?? 0);
  private actionsCover = signalElementDimensions(this.actionsProbe);

  /** By grid frame id, the box of each of its cells from the frame's top left corner. */
  private cellRects = signal<Record<string, Record<string, Rect>>>({});

  protected worldTransform = computed(() => {
    const { x, y, zoom } = this.camera();

    return `translate(${x}px, ${y}px) scale(${zoom})`;
  });

  protected labelScale = computed(() => canvasLabelScale(this.camera().zoom));

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
      columnGap: MATRIX_COLUMN_GAP,
      rowGap,
      groupGap: rowGap * GROUP_GAP_FACTOR,
      minRowHeight: MIN_FRAME_ROW_HEIGHT,
      emptyColumnWidth: FALLBACK_WIDTH,
    };
    const emptyWidths = Object.fromEntries(
      columns.flatMap((column) => (column.folded ? [[column.key, column.folded.width]] : [])),
    );
    const matrix =
      arrangement !== 'matrix'
        ? null
        : layoutMatrix({
            frames: sized,
            columns: columns.map((column) => column.key),
            spacing,
            emptyWidths,
          });
    const rowHeadOf = new Map(
      frames.flatMap((frame) => (frame.rowHead === undefined ? [] : [[frame.row ?? '', frame.rowHead] as const])),
    );
    const sheet =
      matrix ??
      (arrangement === 'grid'
        ? layoutGrid(sized, { ...GRID_SPACING, rowGap })
        : layoutSheet(sized, { ...SPACING, headed: new Set(rowHeadOf.keys()), headRoom: ROW_HEAD_ROOM }));
    const rowHeads =
      arrangement === 'sheet'
        ? sheet.rows.flatMap((row) => {
            const label = rowHeadOf.get(row.name);

            return label === undefined ? [] : [{ key: row.name, label, y: row.y }];
          })
        : [];
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

    return {
      heads,
      groups,
      rowHeads,
      frames: sheet.frames.flatMap((placed) => {
        const frame = byId.get(placed.id);

        return frame ? [{ ...placed, frame, page: pages.get(frame.id) ?? placed, unsized: unsized.has(frame.id) }] : [];
      }),
    };
  });

  protected columnHeads = computed(() => this.layout().heads);

  protected columnHeadsNoted = computed(() => this.columns().some((column) => column.note && !column.folded));

  protected groupHeads = computed(() => this.layout().groups);

  protected rowHeads = computed(() => this.layout().rowHeads);

  private projectedScene = computed(() => {
    const rects = this.projectedRects();
    const selected = this.selectedProjected();
    const index = selected ? this.projected().indexOf(selected) : -1;

    return { frames: rects, focused: rects[index] ?? null };
  });

  private bounds = computed(() => {
    if (this.projected().length > 0) return this.projectedWorld();

    const { frames, heads } = this.layout();

    return (
      boundingRect(frames) ?? boundingRect(heads.map((head) => ({ x: head.x, y: 0, width: head.width, height: 1 })))
    );
  });

  private restedCamera = toSignal(toObservable(this.camera).pipe(debounceTime(inject(CANVAS_LIVE_REST_MS))), {
    initialValue: null,
  });

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

  protected captionLimits = computed(() => {
    const limits = new Map<string, number>();
    const cover = this.actionsCover().offset;

    if (!cover || cover.width === 0 || this.arrangement() === 'grid') return limits;

    const { x, y, zoom } = this.camera();
    const coverLeft = this.viewport().width - cover.width;

    for (const placed of this.placedFrames()) {
      if (y + placed.y * zoom - CAPTION_ROOM >= cover.height) continue;

      limits.set(placed.frame.id, Math.max(0, (coverLeft - (x + placed.x * zoom)) / zoom));
    }

    return limits;
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

  protected pointTargets = computed(() =>
    this.pointing() ? this.targets().filter((placed) => placed.frame.place) : [],
  );

  protected placedDraft = computed(() => {
    const draft = this.draft();
    const frame = draft && this.framesById().get(draft.frameId);
    const crop = frame?.frame.crop;
    const point = crop && draft?.point ? cropPointOf(crop, draft.point) : (draft?.point ?? null);

    if (!frame || !draft) return null;

    return { x: frame.x + (point?.x ?? frame.width), y: frame.y + (point?.y ?? 0) };
  });

  protected zoomPercent = computed(() => Math.round(this.camera().zoom * 100));

  private panStart$ = new Subject<{ event: PointerEvent; threshold: number }>();
  private swallowNextClick = false;

  private fittedFor: string | null | undefined = undefined;

  private coveredAtFit = 0;

  private following: CanvasOpening | { frame: string } | null = null;

  private followsResize = false;

  private restoredUnchecked = false;

  private followedBounds: Rect | null = null;

  private hostLeft = 0;

  protected readonly ZOOM_STEP = ZOOM_STEP;

  constructor() {
    effect(() => {
      this.cameraKey();
      untracked(() => this.panEnd$.next());
    });

    effect(() => {
      const bounds = this.bounds();
      const viewport = this.viewport();
      const key = this.cameraKey();
      const covered = this.covered();

      if (viewport.width === 0 || viewport.height === 0) return;

      untracked(() => {
        const restored = this.restoredCamera();

        if (!bounds && (this.fittedFor === key || restored === null)) return;

        const hostLeft = this.host.nativeElement.getBoundingClientRect().left;
        const shift = this.hostLeft - hostLeft;

        this.hostLeft = hostLeft;

        if (this.restoredUnchecked && bounds && this.fitWhenEmpty(viewport)) return;

        if (this.fittedFor === key && bounds) {
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

        this.fittedFor = key;
        this.coveredAtFit = covered;
        const opening = this.opening();

        this.following = restored === null ? opening : null;
        this.followsResize = restored === null && opening === 'all';
        this.followedBounds = bounds;
        this.restoredUnchecked = restored !== null;
        if (restored) {
          this.camera.set(restored);
          if (bounds) this.fitWhenEmpty(viewport);
        } else if (bounds) this.camera.set(this.fitted({ bounds, viewport, fit: opening }));
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
          dragGestureFrom(event, this.host.nativeElement, { commitThreshold: threshold }).pipe(
            takeUntil(this.panEnd$),
            finalize(() => this.panning.set(false)),
          ),
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

  protected toggleColumn(key: string, event: MouseEvent) {
    event.stopPropagation();
    this.columnToggle.emit(key);
  }

  protected switchGroup(key: string, event: MouseEvent) {
    event.stopPropagation();
    this.groupSwitch.emit(key);
  }

  protected togglePin(id: string) {
    const next = this.pinCard() === undefined && this.openPinId() === id ? null : id;

    this.openPinId.set(next);
    this.pinPick.emit(next);
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
    if (this.pointing()) return;

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

  protected storeHeight(id: string, height: number) {
    this.storeMeasure(id, { height });
  }

  protected storeWidth(id: string, width: number) {
    this.storeMeasure(id, { width });
  }

  protected storeCells(id: string, rects: Record<string, Rect>) {
    this.cellRects.update((all) => ({ ...all, [id]: rects }));
  }

  protected clearPointerFocus() {
    if (!leavesWindow(this.host.nativeElement)) this.pointerFocus.set(false);
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
    this.wheel$.next();
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
      if (this.openPinId()) {
        this.openPinId.set(null);
        this.pinPick.emit(null);
      } else if (this.activeId()) this.leaveActiveFrame();
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

  /** Moves the camera there at once, as a user move does. */
  public moveTo(camera: Camera) {
    this.moveCamera(camera);
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

  public consumeSwallowedClick() {
    const swallow = this.swallowNextClick;

    this.swallowNextClick = false;

    return swallow;
  }

  private fitWhenEmpty(viewport: Size) {
    this.restoredUnchecked = false;

    const view = visibleWorldRect({ camera: this.camera(), viewport, margin: 0 });
    const frames = this.projected().length > 0 ? this.projectedRects() : this.layout().frames;

    if (frames.length === 0 || frames.some((frame) => rectsIntersect(frame, view))) return false;

    this.fitAll();

    return true;
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
    const origin = this.origin();

    if (origin) return { zoom: 1, x: origin.x - bounds.x, y: origin.y - bounds.y };

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
      padding: FIT_PADDING,
      covered: this.covered(),
      inset: {
        left: 0,
        top: (layout.heads.length > 0 ? COLUMN_HEAD_ROOM : 0) + (layout.groups.length > 0 ? GROUP_HEAD_ROOM : 0),
      },
    };
  }

  private inView<T extends Camera | null>(viewport: Size, command: (view: UncoveredView) => T): T {
    return inUncoveredView({ camera: this.camera(), viewport, covered: this.covered() }, command);
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

  private projectedFrameOf(target: EventTarget | null) {
    return target instanceof Node
      ? (this.projected().find((frame) => frame.elementRef.nativeElement.contains(target)) ?? null)
      : null;
  }
}
