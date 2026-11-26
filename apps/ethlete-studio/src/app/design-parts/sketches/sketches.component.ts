import { foldedStatesOf, shownSketchRowsOf } from '@ethlete/cli/sketch-frames';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  inputBinding,
  linkedSignal,
  model,
  output,
  outputBinding,
  signal,
  TemplateRef,
  untracked,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  from,
  fromEvent,
  map,
  merge,
  scan,
  Subject,
  switchMap,
  take,
  tap,
  timer,
} from 'rxjs';
import {
  anchoredDialogOverlayStrategy,
  BUTTON_IMPORTS,
  injectOverlayManager,
  TOOLTIP_IMPORTS,
} from '@ethlete/components';
import {
  ProvideColorDirective,
  injectRenderer,
  equal,
  injectSemanticColorTheme,
  signalElementDimensions,
} from '@ethlete/core';
import { CameraTarget } from '../../components/design-canvas/canvas-camera';
import { Camera } from '../../components/design-canvas/canvas-math';
import { FrameZoom, frameZoomCamera } from '../../components/design-canvas/frame-zoom-camera';
import { mountFrameZoomViewport } from '../../components/design-canvas/frame-zoom-viewport';
import { CanvasViewportComponent } from '../canvas-viewport/canvas-viewport.component';
import { SketchHeadComponent } from '../sketch-head/sketch-head.component';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';
import { CANVAS_LABELS } from '../../i18n/canvas-labels';
import { SYSTEM_TREE_LABELS } from '../../i18n/system-labels';
import { SketchConfirmComponent, SketchConfirmText } from './sketch-confirm.component';
import { AgentLogoComponent } from '../../icons/agent-logo.component';
import { VariantCellComponent, VariantCellMark } from '../variant-cell/variant-cell.component';
import { CommentPinComponent } from '../comment-pin/comment-pin.component';
import { CommentTargetComponent } from '../comment-target/comment-target.component';
import { CommentListComponent } from '../comment-flow/comment-list.component';
import { CommentDraftComponent, CommentSendPhase } from '../system-page/comment-draft.component';
import { DisclosureComponent } from '../disclosure/disclosure.component';
import { PartTreeComponent } from '../part-tree/part-tree.component';
import { SketchChange } from '../../../host/design';
import { SHELL_SAMPLE, ShellAction, ShellPageComponent, ShellState } from '../shell-main/shell-page.component';
import { ZoomChipComponent } from '../zoom-chip/zoom-chip.component';
import { OpenPointsChipComponent } from '../system-page/open-points-chip.component';
import { OpenPointGroup, OpenPointTarget } from '../system-page/system-page-sample';
import {
  MATRIX_COLUMN_GAP,
  MATRIX_HEAD_MIN,
  MATRIX_LABEL_MIN,
  MATRIX_MIN_COLUMN,
  matrixBlocksOf,
  matrixWidthFit,
  shortLabelOf,
  variantsLeaveMatrixOf,
} from './matrix-blocks';
import { gridColumnWidthOf, gridScaleOf, interactionGridOf, variantsStackedOf } from './interaction-grid';
import { cropGroupsOf, SketchCropReason } from './sketch-crops';
import {
  SKETCH_CURRENT,
  SKETCH_DRAWN,
  SKETCH_HOLD,
  SKETCH_PINS,
  SKETCH_ROUNDS,
  SKETCH_ROWS,
  SKETCH_TREE,
  SketchAgentRun,
  SketchComment,
  SketchCommentDraft,
  SketchCommentPlace,
  SketchConfirm,
  SketchRepick,
  SketchHold,
  SketchMergePort,
  SketchPin,
  SketchRow,
  SketchWithdrawn,
  SketchShot,
  SketchStatus,
} from './sketches-sample';

const MOVE_REST_MS = 200;

export type SketchShotContext = { $implicit: SketchRow; state: string };

const ZOOM_STEP = 1.5;

const statesOf = (rows: readonly SketchRow[]) => [
  ...new Set(rows.flatMap((row) => row.shots.map((shot) => shot.state))),
];

const gridStatesOf = (rows: readonly SketchRow[]) => [
  ...new Set(rows.flatMap((row) => row.shots.flatMap((shot) => [shot.state, ...(shot.restOf ?? [])]))),
];

const EDIT_ROW_LABELS: Record<string, string> = {
  old: SKETCHES_LABELS.editOld,
  new: SKETCHES_LABELS.editNew,
};

const isBaseRow = (row: SketchRow) => row.key === SKETCH_CURRENT || row.key === 'old' || row.key === 'new';

export { foldedStatesOf };

const WRAP_WIDTH = 1440;

const MAX_COLUMNS = 4;

const TRANSPOSE_SHARE = 4;

const COLUMN_GAP = MATRIX_COLUMN_GAP;

const GRID_COLUMN_GAP = 8;

const FOCUS_PADDING = 24;

const MIN_TEXT = 12;

const NOTE_TEXT = 15;

const LABEL_TEXT = 13;

const MIN_LABEL = 9;

const FIT_PADDING = 16;

const FIT_PASSES = 6;

const FIT_SETTLED = 0.002;

type FitDom = {
  columns: number;
  blocks: number;
  list: HTMLElement;
  sections: HTMLElement[];
  stages: HTMLElement[];
  frames: HTMLElement[];
  frameSizes: ({ width: number; height: number } | null)[];
  notes: HTMLElement[];
  labels: HTMLElement[];
  labelRows: HTMLElement[];
  gutters: HTMLElement[];
  matrix: HTMLElement | null;
  fold: HTMLElement | null;
};

const frameSizeOf = (frame: HTMLElement) => {
  const inner = frame.firstElementChild;

  if (!(inner instanceof HTMLElement)) return null;

  const grows = !frame.hasAttribute('data-sk-cropped') && inner.scrollWidth > inner.offsetWidth;

  return {
    width: grows ? inner.scrollWidth : parseFloat(inner.style.width),
    height: parseFloat(inner.style.height),
  };
};

const frameKeyOf = (row: SketchRow, state: string) => `${row.key} ${state}`;

const zoomOf = (camera: 'fit' | '100' | Camera): FrameZoom =>
  camera === 'fit' ? 'fit' : camera === '100' ? 1 : camera.zoom;

const textAt = (size: number, { scale, fit }: { scale: number; fit: number }) => {
  const floor = Math.max(MIN_TEXT, size * fit);

  return scale >= fit ? Math.max(MIN_TEXT, size * scale) : (floor * scale) / fit;
};

const faceKeyOf = ({ family, weight, style, stretch, unicodeRange }: FontFace) =>
  [family, weight, style, stretch, unicodeRange].join('|');

const countNewFaces = (
  { loads, seen }: { loads: number; seen: ReadonlySet<string> },
  faces: readonly string[] | null,
) =>
  faces === null || faces.some((face) => !seen.has(face))
    ? { loads: loads + 1, seen: new Set([...seen, ...(faces ?? [])]) }
    : { loads, seen };

const isWithdrawn = (row: SketchRow) => row.withdrawn !== undefined;

const dropsBaseState = (key: string, listed: readonly SketchRow[]) => {
  const own = new Set(listed.find((row) => row.key === key)?.shots.map((shot) => shot.state));

  return statesOf(listed.filter(isBaseRow)).some((state) => !own.has(state));
};

const isPending = (row: SketchRow) => row.shots.some((shot) => shot.changed === null);

@Component({
  selector: 'ethlete-sketches',
  templateUrl: './sketches.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    ProvideColorDirective,
    TOOLTIP_IMPORTS,
    NgTemplateOutlet,
    AgentLogoComponent,
    CanvasViewportComponent,
    SketchHeadComponent,
    CommentPinComponent,
    VariantCellComponent,
    CommentTargetComponent,
    CommentListComponent,
    CommentDraftComponent,
    DisclosureComponent,
    PartTreeComponent,
    ShellPageComponent,
    ZoomChipComponent,
    OpenPointsChipComponent,
  ],
  host: { class: 'block h-screen w-full', '(keydown.escape)': 'frameActivate.emit(null)' },
})
export class SketchesComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private injector = inject(Injector);
  private renderer = injectRenderer();
  private overlay = injectOverlayManager();
  public shell = input<ShellState>(SHELL_SAMPLE);
  public camera = input<'fit' | '100' | Camera>('fit');
  public restoredCamera = input<Camera | null>(null);
  public selected = input<string | undefined>(undefined);
  public part = input('components/title-bar');
  public rows = input<SketchRow[]>(SKETCH_ROWS);
  public fresh = input(false);
  public empty = input(false, { transform: booleanAttribute });
  public autoMerge = input(false);
  public merging = input(false);
  public subSketch = input(false);
  public approved = input<string | null>(null);
  public subSketchesOpen = input(false);
  public repicks = input<Record<string, SketchRepick>>({});
  public status = input<SketchStatus>('waiting');
  public openPoints = input<OpenPointGroup[]>([]);
  public pointsClosed = model(true);
  public errored = input<readonly string[]>([]);
  public drawn = input<string | null>(SKETCH_DRAWN);
  public hold = input<SketchHold>(SKETCH_HOLD);
  public reason = input(false);
  public failures = input<Readonly<Record<string, string>>>({});
  public agent = input<SketchAgentRun | null>(null);
  public port = input<SketchMergePort | null>(null);
  public rounds = input(SKETCH_ROUNDS);
  public round = input(SKETCH_ROUNDS[0]?.value ?? '');
  public pins = input<SketchPin[]>(SKETCH_PINS);
  public sameOpen = model(false);
  public statesOpen = model(false);
  public withdrawn = model<SketchWithdrawn>('hidden');
  public wholeScreens = model<readonly string[]>([]);

  public loadingShots = input<ReadonlySet<string>>(new Set());
  public nearLoadingShots = input<ReadonlySet<string> | null>(new Set());
  public shot = input<TemplateRef<SketchShotContext> | null>(null);
  public tree = input(SKETCH_TREE);
  public error = input<string | null>(null);
  public listError = input<string | null>(null);
  public comments = input<SketchComment[] | null>(null);
  public selectedComment = input<string | null>(null);
  public commentMode = model(false);
  public commentDraft = input<SketchCommentDraft | null>(null);
  public draftText = model('');
  public sendPhase = input<CommentSendPhase | null>(null);
  public sendReason = input('');
  public confirm = model<SketchConfirm | null>(null);
  public live = input(false);
  public retry = output();
  public frameActivate = output<string | null>();
  public shellAction = output<ShellAction>();
  public discard = output();
  public merge = output<string>();
  public roundChange = output<string>();

  public pinToggle = output<string>();
  public pick = output<string>();
  public expandedChange = output<readonly string[]>();
  public cameraChange = output<Camera | null>();

  /** True while the camera pans or zooms, false once it rested for `MOVE_REST_MS`. */
  public moving = output<boolean>();
  public listWidthChange = output<number>();
  public openPoint = output<OpenPointTarget>();
  public commentStart = output<SketchCommentPlace>();
  public commentCancel = output();
  public sendComment = output<string>();
  public commentPick = output<string>();
  private list = viewChild.required('list', { read: ElementRef<HTMLElement> });
  private world = viewChild.required('world', { read: ElementRef<HTMLElement> });
  private matrix = viewChild('matrix', { read: ElementRef<HTMLElement> });
  private fold = viewChild('fold', { read: ElementRef<HTMLElement> });

  private stages = viewChildren('stage', { read: ElementRef<HTMLElement> });
  private sections = viewChildren('section', { read: ElementRef<HTMLElement> });
  private columnHeadParts = viewChildren('columnHeadPart', { read: ElementRef<HTMLElement> });
  private lineHeads = viewChildren('lineHeads', { read: ElementRef<HTMLElement> });
  private cells = viewChildren(VariantCellComponent);
  private takes = viewChildren('take', { read: ElementRef<HTMLElement> });
  private head = viewChild.required(SketchHeadComponent);
  private gutters = viewChildren('gutter', { read: ElementRef<HTMLElement> });
  private notes = viewChildren('note', { read: ElementRef<HTMLElement> });
  public viewport = computed(() => this.list().nativeElement as HTMLElement);
  private frames = computed(() => this.cells().flatMap((cell) => cell.frameRef() ?? []));
  private labels = computed(() => this.cells().flatMap((cell) => cell.stateLabelRef() ?? []));
  private labelRows = computed(() => this.cells().flatMap((cell) => cell.labelRowRef() ?? []));
  private listSize = signalElementDimensions(this.list);

  protected readonly LABELS = SKETCHES_LABELS;
  protected readonly CANVAS_LABELS = CANVAS_LABELS;
  protected readonly IS_WITHDRAWN = isWithdrawn;
  protected readonly CURRENT = SKETCH_CURRENT;
  protected readonly COLUMN_GAP = COLUMN_GAP;
  protected readonly FRAME_KEY_OF = frameKeyOf;
  protected readonly SHORT_LABEL_OF = shortLabelOf;
  public readonly STACK_INSETS = [32, 64];

  protected canvas = frameZoomCamera(() => {
    const camera = this.camera();

    return this.restoredCamera() ?? (typeof camera === 'object' ? camera : { x: 0, y: 0, zoom: zoomOf(camera) });
  });
  protected reasonOpen = linkedSignal(this.reason);
  protected roundsOpen = signal(false);
  protected selectedFrame = signal<string | null>(null);
  private confirmRow = signal<string | null>(null);
  private confirmRef: { close: () => void } | null = null;
  private confirmOrigin: HTMLElement | null = null;
  private fitAt = signal<{ scale: number; fonts: number } | null>(null);
  private gutterWidth = signal(0);
  private fitKey: string | null = null;
  private fitElements: (HTMLElement | null)[] | null = null;
  private appliedKey: string | null = null;
  // fonts.ready resolves before the gutter's mono face loads; without loadingdone the fit keeps the fallback's gutter.
  // Chromium re-fires loadingdone with faces it already loaded whenever new text renders, so only a new face counts:
  // a counted re-fire would re-base the held note fit and move every frame at a user zoom.
  private fontLoads = toSignal(
    merge(
      from(this.document.fonts.ready).pipe(map(() => null)),
      fromEvent<FontFaceSetLoadEvent>(this.document.fonts, 'loadingdone').pipe(
        map(({ fontfaces }) => fontfaces.map(faceKeyOf)),
      ),
    ).pipe(
      scan(countNewFaces, { loads: 0, seen: new Set<string>() }),
      map(({ loads }) => loads),
      distinctUntilChanged(),
    ),
    { initialValue: 0 },
  );
  private userCamera$ = new Subject<Camera | null>();

  private gesture$ = new Subject<void>();
  protected commentTargeting = computed(() => this.commentMode() && this.comments() !== null);
  protected withdrawnCount = computed(() => this.rows().filter(isWithdrawn).length);
  protected errorInRow = computed(
    () => this.error() !== null && this.rows().some((row) => row.key === this.selected() && row.key !== SKETCH_CURRENT),
  );
  protected isEdit = computed(() => this.part().endsWith('@edit'));
  private listedRows = computed(
    () => {
      const edit = this.isEdit();
      const variantStates = new Set(
        this.rows().flatMap((row) =>
          row.key === SKETCH_CURRENT ? [] : row.shots.flatMap((shot) => (shot.inherited ? [] : [shot.state])),
        ),
      );
      const sharesAState = (row: SketchRow) =>
        variantStates.size === 0 || row.shots.some((shot) => variantStates.has(shot.state));
      const rows = this.rows().filter(
        (row) =>
          !((this.fresh() || edit || !sharesAState(row)) && row.key === SKETCH_CURRENT) &&
          (this.withdrawn() === 'shown' || !isWithdrawn(row)),
      );

      return edit ? rows.map((row) => ({ ...row, label: EDIT_ROW_LABELS[row.key] ?? row.label })) : rows;
    },
    { equal },
  );
  private hiddenWithdrawnRows = computed(() => (this.withdrawn() === 'shown' ? [] : this.rows().filter(isWithdrawn)), {
    equal,
  });
  protected pendingStates = computed(
    () =>
      new Set(
        this.listedRows().flatMap((row) =>
          row.shots.flatMap((shot) => (shot.changed === null && row.key !== SKETCH_CURRENT ? [shot.state] : [])),
        ),
      ),
  );
  private pendingRows = computed(
    () =>
      new Set(
        this.listedRows()
          .filter(isPending)
          .map((row) => row.key),
      ),
  );
  protected foldedStates = computed(() => {
    const shown = new Set(statesOf(this.shownRowsOf(false)));

    return new Set(statesOf(this.listedRows()).filter((state) => !shown.has(state)));
  });
  protected foldLabel = computed(() => {
    const count = this.foldedStates().size;

    if (this.pendingStates().size === 0) {
      return this.statesOpen() ? this.LABELS.openStates(count) : this.LABELS.foldedStates(count);
    }

    return this.listError() ? this.LABELS.pendingFailed(count) : this.LABELS.pendingStates(count);
  });
  public shownRows = computed(() => this.shownRowsOf(this.statesOpen()));
  protected stageStates = computed(() => statesOf(this.shownRows()));
  protected dropping = computed(
    () =>
      new Set(
        this.listedRows()
          .filter((row) => !isBaseRow(row) && dropsBaseState(row.key, this.listedRows()))
          .map((row) => row.key),
      ),
  );
  protected discardable = computed(() => !this.isEdit());
  protected grid = computed(() =>
    this.shownRows().some((row) => row.perLine) ? null : interactionGridOf(gridStatesOf(this.shownRows())),
  );
  public columns = computed(() => {
    const grid = this.grid();

    if (grid) return grid.interactions.length;

    const rows = this.shownRows();
    const widest = Math.max(1, ...rows.map((row) => row.width));
    const most = Math.max(1, this.stageStates().length);
    const perLine = Math.max(0, ...rows.map((row) => row.perLine ?? 0));

    if (perLine > 0) return Math.min(perLine, most);

    return Math.max(1, Math.min(MAX_COLUMNS, most, Math.floor(WRAP_WIDTH / widest)));
  });
  private widest = computed(() => Math.max(1, ...this.shownRows().map((row) => row.width)));
  private frameStates = computed(
    () =>
      new Map(
        this.shownRows().flatMap((row) => row.shots.map((shot) => [frameKeyOf(row, shot.state), shot.state] as const)),
      ),
  );
  private lineWidths = computed(() => {
    const widths = new Map<string, number>();

    for (const row of this.shownRows()) {
      for (const shot of row.shots)
        widths.set(shot.state, Math.max(widths.get(shot.state) ?? 0, shot.width ?? row.width));
    }

    return widths;
  });
  private listWidth = computed(() => this.listSize().client?.width ?? 0);
  protected listMeasured = computed(() => this.listWidth() > 0);
  private sizedWidest = computed(() =>
    Math.max(0, ...this.shownRows().flatMap((row) => (row.sized === false ? [] : [row.width]))),
  );
  private atFit = computed(() => this.canvas.zoom() === 'fit');
  private firstRowSized = computed(
    () =>
      this.errored().length > 0 ||
      Object.keys(this.failures()).length > 0 ||
      this.shownRows().some((row) => row.sized !== false && row.shots.length > 0) ||
      this.listedRows().every((row) => row.shots.length === 0),
  );
  // Holds only the first layout of a part: a later size loss (a zoom, a refused picture) must not hide a shown view.
  private partSizedSource = computed(() => ({ part: this.part(), sized: this.firstRowSized() }));
  protected partSized = linkedSignal<{ part: string; sized: boolean }, boolean>({
    source: this.partSizedSource,
    computation: ({ part, sized }, previous) => sized || (previous?.source.part === part && previous.value),
  });
  private fitScale = computed(() => this.fitAt()?.scale ?? 1);
  protected scale = computed(() => {
    const zoom = this.canvas.zoom();

    return zoom === 'fit' ? this.fitScale() : zoom;
  });
  // A user zoom holds the fit the labels were sized at: a new fit from a wider viewport would resize the gutter and head
  // columns and move every frame on screen.
  private noteFit = linkedSignal<{ zoom: FrameZoom; fit: { scale: number; fonts: number } | null }, number>({
    source: () => ({ zoom: this.canvas.zoom(), fit: this.fitAt() }),
    computation: ({ zoom, fit }, previous) =>
      zoom === 'fit' || fit === null || previous?.source.zoom !== zoom || previous.source.fit?.fonts !== fit.fonts
        ? (fit?.scale ?? 1)
        : previous.value,
  });
  protected noteSize = computed(() => textAt(NOTE_TEXT, { scale: this.scale(), fit: this.noteFit() }));
  protected headHidden = computed(() => this.noteSize() < MIN_LABEL);
  protected portNote = computed(() => {
    const port = this.port();

    return port ? this.LABELS.mergePort(port.merged) : null;
  });
  protected labelFont = computed(() =>
    textAt(LABEL_TEXT, { scale: Math.min(this.scale(), this.noteFit()), fit: this.noteFit() }),
  );
  protected labelSize = computed(() =>
    this.labelsHiddenAt({ scale: this.scale(), label: this.labelFont() }) ? null : this.labelFont(),
  );
  private shownStatus = computed(() =>
    (this.agent() && !this.agent()?.failure) || this.port()
      ? 'drawing'
      : this.errored().length > 0 && ['waiting', 'not-ready'].includes(this.status())
        ? 'failed'
        : this.status(),
  );
  private editDrawing = computed(() => {
    if (!this.isEdit() || this.shownStatus() === 'failed') return false;
    if (this.listError() === null && this.pendingStates().size > 0) return true;

    const near = this.nearLoadingShots();

    return near === null ? this.shownRows().some((row) => row.shots.length > 0) : near.size > 0;
  });
  // Holds only the first finished view of an edit sketch: a later reload of a picture must not hide a shown view.
  private editDrawnSource = computed(() => ({ part: this.part(), drawn: !this.editDrawing() }));
  private editDrawn = linkedSignal<{ part: string; drawn: boolean }, boolean>({
    source: this.editDrawnSource,
    computation: ({ part, drawn }, previous) => drawn || (previous?.source.part === part && previous.value),
  });
  protected sizing = computed(() => !this.partSized() || !this.editDrawn());
  // Opacity, not visibility: Chromium stops rendering a hidden cross-origin frame, so a live frame would never report painted.
  protected editHeld = computed(() => this.partSized() && !this.editDrawn());
  protected editHolding = computed(() => this.isEdit() && this.sizing());
  protected headStatus = computed(() =>
    this.shownStatus() === 'waiting' && !this.editDrawn() ? 'drawing' : this.shownStatus(),
  );

  public drawnKey = computed(() => (this.status() === 'drawing' ? this.drawn() : null));
  private sameRowsSource = computed(() => ({
    part: this.part(),
    rows: this.shownRows(),
    listed: this.listedRows(),
    drawn: this.drawnKey(),
  }));
  protected sameRows = linkedSignal<
    { part: string; rows: SketchRow[]; listed: SketchRow[]; drawn: string | null },
    SketchRow[]
  >({
    source: this.sameRowsSource,
    computation: ({ part, rows, listed, drawn }, previous) => {
      const wasSame = new Set(previous?.source.part === part ? previous.value.map((row) => row.key) : []);
      const shotsOf = (key: string) => listed.find((row) => row.key === key)?.shots ?? [];

      return rows.filter(
        (row) =>
          !isBaseRow(row) &&
          row.key !== drawn &&
          shotsOf(row.key).length > 0 &&
          !dropsBaseState(row.key, listed) &&
          shotsOf(row.key).every((shot) => shot.changed === false || (shot.changed === null && wasSame.has(row.key))),
      );
    },
  });
  protected changedRows = computed(() => {
    const same = this.sameRows();

    return this.shownRows().filter((row) => !same.includes(row));
  });
  private fitTransposed = computed(
    () =>
      this.listWidth() > 0 &&
      this.sizedWidest() > this.listWidth() / TRANSPOSE_SHARE &&
      (this.grid() === null || cropGroupsOf(this.shownRows()).length > 0) &&
      !this.shownRows().some((row) => row.perLine) &&
      !variantsLeaveMatrixOf({
        room: this.listWidth(),
        frameWidth: this.sizedWidest(),
        variants: this.changedRows().length,
        states: this.stageStates().length,
      }),
  );
  // A user zoom holds the layout: a width change from the panel or the viewport would swap rows and columns under the camera.
  public transposed = linkedSignal<{ zoom: FrameZoom; measured: boolean; widest: number; fit: boolean }, boolean>({
    source: () => ({
      zoom: this.canvas.zoom(),
      measured: this.listMeasured(),
      widest: this.sizedWidest(),
      fit: this.fitTransposed(),
    }),
    computation: ({ zoom, measured, widest, fit }, previous) =>
      zoom === 'fit' ||
      !measured ||
      previous === undefined ||
      previous.source.zoom !== zoom ||
      !previous.source.measured ||
      previous.source.widest !== widest
        ? fit
        : previous.value,
  });
  private cropGroups = computed(() => (this.transposed() ? cropGroupsOf(this.shownRows()) : []));

  protected screenMode = computed(() => this.cropGroups().length > 0);
  protected groupOfState = computed(
    () => new Map(this.cropGroups().flatMap((group) => group.states.map((state) => [state, group] as const))),
  );
  private matrixStates = computed(() => {
    const groups = this.groupOfState();

    return [...new Set(this.shownRows().flatMap((row) => row.shots.map((shot) => shot.state)))].filter(
      (state) => (groups.get(state)?.states[0] ?? state) === state,
    );
  });
  private stackedFit = signal(false);
  protected stacked = computed(
    () => this.stackedFit() && !this.transposed() && this.listMeasured() && this.changedRows().length > 1,
  );
  protected sideBySide = computed(
    () => !this.transposed() && this.listMeasured() && this.changedRows().length > 1 && !this.stackedFit(),
  );
  protected sameKeys = computed(
    () =>
      new Set(
        this.listedRows()
          .filter(
            (row) =>
              !isBaseRow(row) &&
              row.shots.length > 0 &&
              !this.dropping().has(row.key) &&
              row.shots.every((shot) => shot.changed === false),
          )
          .map((row) => row.key),
      ),
  );
  protected sameLabel = computed(() =>
    this.LABELS.sameVariants(this.sameRows().map((row) => row.label ?? this.LABELS.variant(row.key))),
  );
  protected matrixRows = computed(() =>
    this.sameOpen() ? [...this.changedRows(), ...this.sameRows()] : this.changedRows(),
  );
  protected matrixTop = computed(() => (this.sameRows().length > 0 && this.sameOpen() ? 2 : 1));
  protected matrixBlocks = computed(() => {
    const rows = this.matrixRows();
    const heights = this.matrixStates().map((state) =>
      Math.max(
        0,
        ...rows.flatMap((row) =>
          row.shots
            .filter((shot) => shot.state === state)
            .map((shot) => this.shownHeightOf(row, shot) * this.lineFactorOf(state)),
        ),
      ),
    );
    let start = 0;

    return matrixBlocksOf(heights, {
      columns: rows.length,
      frameWidth: this.widest(),
      gutter: this.gutterWidth() || undefined,
      viewport: { width: this.listWidth(), height: this.listSize().client?.height ?? 0 },
    }).map((size) => {
      const states = this.matrixStates().slice(start, start + size);

      start += size;

      return { states };
    });
  });
  protected sameColumn = computed(() => this.changedRows().length + 2);
  protected matrixStride = computed(() => this.matrixRows().length + 1);
  protected matrixTallest = computed(() => Math.max(0, ...this.matrixBlocks().map((block) => block.states.length)));
  protected matrixFoldColumn = computed(() => this.matrixBlocks().length * this.matrixStride() + 1);
  protected matrixColumns = computed(() =>
    this.matrixColumnsAt({ columns: this.matrixRows().length, blocks: this.matrixBlocks().length }, this.scale()),
  );
  protected percent = computed(() => {
    return Math.round((this.canvas.preview()?.zoom ?? this.shownZoom()) * 100);
  });
  protected columnGap = computed(() => (this.grid() ? GRID_COLUMN_GAP : COLUMN_GAP));

  constructor() {
    afterRenderEffect(() => {
      const kind = this.confirm();
      const target = kind ? this.confirmTargetOf(kind) : null;

      untracked(() => this.showConfirm(kind, target));
    });

    this.destroyRef.onDestroy(() => {
      const open = this.confirmRef;

      this.confirmRef = null;
      open?.close();
    });

    afterNextRender(() => {
      const teardown = mountFrameZoomViewport({
        viewport: this.list().nativeElement,
        content: this.world().nativeElement,
        frameSelector: '[data-sk-frame]',
        camera: () => ({ ...this.canvas.pan(), zoom: this.shownZoom() }),
        move: (camera) => this.move(camera),
        preview: (shown, settle) => {
          this.canvas.showPreview(shown, settle);
          if (shown) this.gesture$.next();
        },
        show: (target, frame) => this.show(target, frame),
        select: (frame) => this.selectedFrame.set(frame.dataset['skFrame'] ?? null),
        activate: (frame) => this.frameActivate.emit(frame.dataset['skFrame'] ?? null),
        afterRender: (write) => afterNextRender({ write }, { injector: this.injector }),
      });

      this.destroyRef.onDestroy(teardown);
    });

    afterRenderEffect(() => {
      this.fontLoads();
      this.listSize();
      this.shownRows();
      this.matrixRows();
      this.sections();
      this.stages();
      this.frames();
      this.notes();
      this.labels();
      this.labelRows();
      this.gutters();

      // The rows render only once the list is measured; a fit taken before would be 1, and a user zoom would hold it.
      // A fit taken under a zoom preview reads the boxes scaled by its transform.
      if (!this.listMeasured() || this.canvas.preview()) return;

      const list: HTMLElement = this.list().nativeElement;
      const elementsOf = (refs: readonly ElementRef<HTMLElement>[]) => refs.map(({ nativeElement }) => nativeElement);
      const frames = elementsOf(this.frames());
      const dom: FitDom = {
        columns: this.transposed() ? this.matrixRows().length : this.columns(),
        blocks: this.transposed() ? this.matrixBlocks().length : 1,
        list,
        sections: elementsOf(this.sections()),
        stages: elementsOf(this.stages()),
        frames,
        frameSizes: frames.map(frameSizeOf),
        notes: elementsOf(this.notes()),
        labels: elementsOf(this.labels()),
        labelRows: elementsOf(this.labelRows()),
        gutters: elementsOf(this.gutters()),
        matrix: this.matrix()?.nativeElement ?? null,
        fold: this.fold()?.nativeElement ?? null,
      };

      // Listing and shot answers hand in new arrays of equal content; a refit per answer blocks the page for seconds.
      const key = JSON.stringify({
        fonts: this.fontLoads(),
        list: this.listSize(),
        rows: this.shownRows(),
        matrixRows: this.matrixRows().map((row) => row.key),
        blocks: this.matrixBlocks().length,
        transposed: this.transposed(),
        sideBySide: this.sideBySide(),
        columns: this.columns(),
        atFit: this.atFit(),
        sizes: dom.frameSizes,
      });
      const elements = [
        dom.sections,
        dom.stages,
        dom.frames,
        dom.notes,
        dom.labels,
        dom.labelRows,
        dom.gutters,
        [dom.matrix, dom.fold],
      ].flat();
      const sameElements =
        this.fitElements?.length === elements.length &&
        this.fitElements.every((element, index) => element === elements[index]);
      const changed = key !== this.fitKey || !sameElements;

      const fitted = untracked(this.fitAt);
      // A user zoom holds the fit; a refit there lays every cell out twice, 40 ms per row change on WebKit.
      const refit = (this.atFit() || fitted?.fonts !== this.fontLoads()) && changed;

      this.fitKey = key;
      this.fitElements = elements;

      untracked(() => {
        if (refit) {
          const stacked = this.stackedOf(dom);

          if (stacked !== this.stackedFit()) {
            const side = this.sideBySide();

            this.stackedFit.set(stacked);

            // The effect runs again only through `sideBySide`; without a layout change this run has to fit.
            if (this.sideBySide() !== side) return;
          }

          this.fitAt.set({ scale: this.fitScaleOf(dom), fonts: this.fontLoads() });

          const gutter = Math.max(0, ...dom.gutters.map((element) => element.offsetWidth));

          if (dom.matrix && Math.abs(gutter - this.gutterWidth()) > 1) this.gutterWidth.set(gutter);
        }

        const applied = { scale: this.scale(), note: this.noteSize(), label: this.labelFont() };
        const appliedKey = JSON.stringify(applied);

        if (!changed && appliedKey === this.appliedKey) return;

        this.appliedKey = appliedKey;
        this.applyScale(applied, dom);
      });
    });

    afterRenderEffect({
      read: () => {
        this.fontLoads();
        this.listSize();
        this.scale();
        this.noteSize();
        this.shownRows();
        this.matrixRows();
        this.canvas.measure(this.list().nativeElement, this.world().nativeElement);
      },
    });

    this.gesture$
      .pipe(
        switchMap(() => merge([true], timer(MOVE_REST_MS).pipe(map(() => false)))),
        distinctUntilChanged(),
        tap((moving) => this.moving.emit(moving)),
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

    toObservable(this.listWidth)
      .pipe(
        filter((width) => width > 0),
        switchMap((width) => timer(500).pipe(map(() => width))),
        distinctUntilChanged(),
        tap((width) => this.listWidthChange.emit(width)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected gridLineOf(index: number) {
    return `${2 + index * 2} / span 2`;
  }

  protected stateHeightOf(state: string) {
    return Math.max(
      0,
      ...this.shownRows()
        .flatMap((row) => row.shots.filter((shot) => shot.state === state))
        .map((shot) => shot.height),
    );
  }

  protected headPartsOf(name: string) {
    return name.split(/(?<=-)/);
  }

  protected restOfIn(row: SketchRow, state: string) {
    return row.shots.some((shot) => shot.restOf?.includes(state));
  }

  protected gridOf(row: SketchRow, scale = this.scale()) {
    if (this.grid()) {
      return `repeat(${this.columns()}, minmax(${gridColumnWidthOf(row) * scale}px, min-content))`;
    }

    return `repeat(${this.columns()}, minmax(${row.width * scale}px, max-content))`;
  }

  protected shotOf(row: SketchRow, state: string) {
    return row.shots.find((shot) => shot.state === state) ?? null;
  }

  protected matrixLineOf(states: readonly string[], state: string) {
    return `${this.matrixTop() + 1 + states.indexOf(state) * 2} / span 2`;
  }

  protected foldedOf(state: string) {
    return (this.groupOfState().get(state)?.states ?? []).filter((folded) => folded !== state);
  }

  protected croppedOf(state: string) {
    const group = this.groupOfState().get(state);

    return group && !this.wholeScreens().includes(group.states[0] ?? state) ? group : undefined;
  }

  protected toggleScreen(state: string) {
    this.wholeScreens.update((whole) =>
      whole.includes(state) ? whole.filter((shown) => shown !== state) : [...whole, state],
    );
  }

  /** In the matrix every state line fills the column: a line of narrow shots scales up to it, never past 100 %. */
  protected lineScaleOf(state: string, scale = this.scale()) {
    return this.transposed() ? Math.min(scale * this.lineFactorOf(state), Math.max(1, scale)) : scale;
  }

  protected shownHeightOf(row: SketchRow, item: SketchShot) {
    const crop = this.croppedOf(item.state)?.crop;

    return crop ? ((item.width ?? row.width) * crop.height) / crop.width : item.height;
  }

  protected cropTransformOf(row: SketchRow, item: SketchShot) {
    const group = this.croppedOf(item.state);

    if (!group) return null;

    const unit = (item.width ?? row.width) / group.change.width;

    return `scale(${group.magnify}) translate(${-group.crop.x * unit}px, ${-group.crop.y * unit}px)`;
  }

  protected marksOf(row: SketchRow, item: SketchShot): VariantCellMark[] {
    const { change } = item;

    if (!change || row.key === SKETCH_CURRENT) return [];

    const width = item.width ?? row.width;
    const unit = width / change.width;
    const height = change.height * unit;
    const markOf = (box: SketchChange['box']) => {
      const left = Math.max(0, box.x * unit - 4);
      const top = Math.max(0, box.y * unit - 4);

      return {
        left,
        top,
        width: Math.min(width, (box.x + box.width) * unit + 4) - left,
        height: Math.min(height, (box.y + box.height) * unit + 4) - top,
      };
    };
    const moves = change.moves ?? [];
    const keyOf = (box: SketchChange['box']) => `${box.x} ${box.y} ${box.width} ${box.height}`;
    const moved = new Set(moves.flatMap(({ from, to }) => [keyOf(from), keyOf(to)]));
    const areas = (change.areas?.length ? change.areas : [change.box]).filter((box) => !moved.has(keyOf(box)));

    return [...moves.map(({ from, to }) => ({ ...markOf(to), from: markOf(from) })), ...areas.map(markOf)];
  }

  protected reasonTextOf(reason: SketchCropReason) {
    const { variant, text } = reason;

    return variant ? this.LABELS.variantReason(variant.label ?? this.LABELS.variant(variant.key), text) : text;
  }

  protected withdrawnMarkOf(reason: string) {
    return reason ? SYSTEM_TREE_LABELS.withdrawnWith(reason) : SYSTEM_TREE_LABELS.withdrawnLabel;
  }

  protected missingLabelOf(row: SketchRow) {
    if (this.failures()[row.key] !== undefined) return SKETCHES_LABELS.status.failed;

    return row.key === SKETCH_CURRENT
      ? SKETCHES_LABELS.newInSketch
      : SKETCHES_LABELS.removedIn(row.label ?? SKETCHES_LABELS.variant(row.key));
  }

  protected matrixMissingLabelOf(row: SketchRow) {
    if (this.failures()[row.key] !== undefined) return SKETCHES_LABELS.status.failed;

    return row.key === SKETCH_CURRENT || row.key === 'old' ? SKETCHES_LABELS.newInSketch : SKETCHES_LABELS.removed;
  }

  protected isDrawn(row: SketchRow) {
    return row.key === this.drawnKey() || (this.status() === 'drawing' && row.drawing !== undefined);
  }

  protected isSame(row: SketchRow, unchanged: boolean | null) {
    return !isBaseRow(row) && unchanged === false && !this.isPending(row) && !this.isDrawn(row);
  }

  protected isEditSide(row: SketchRow) {
    return row.key === 'old' || row.key === 'new';
  }

  protected isPending(row: SketchRow) {
    return row.key !== SKETCH_CURRENT && this.pendingRows().has(row.key);
  }

  protected pinOf(key: string) {
    return this.pins().find((pin) => pin.variant === key);
  }

  protected askDiscard() {
    this.confirmRow.set(null);
    this.confirm.set('discard');
  }

  protected askMerge(row: SketchRow) {
    this.confirmRow.set(row.key);
    this.confirm.set('merge');
  }

  protected commentsOn(row: SketchRow, state: string) {
    return (this.comments() ?? []).filter((comment) => comment.variant === row.key && comment.shot === state);
  }

  protected unplacedCommentsOf(row: SketchRow) {
    const shown = new Set(row.shots.map((shot) => shot.state));

    return (this.comments() ?? []).filter((comment) => comment.variant === row.key && !shown.has(comment.shot));
  }

  protected draftOn(row: SketchRow, state: string) {
    const draft = this.commentDraft();

    return draft && draft.variant === row.key && draft.shot === state ? draft : null;
  }

  protected startComment(trigger: Event, { row, shot }: { row: SketchRow; shot: string }) {
    const event = trigger instanceof MouseEvent && trigger.type === 'click' ? trigger : null;
    const key = frameKeyOf(row, shot);
    const hit = this.frames().find((frame) => frame.nativeElement.getAttribute('data-sk-frame') === key)?.nativeElement;

    if (!hit) return;

    const box = hit.getBoundingClientRect();
    const natural = hit.firstElementChild instanceof HTMLElement ? hit.firstElementChild.offsetWidth : box.width;
    const factor = natural > 0 ? box.width / natural : 1;
    const point =
      event && factor > 0 ? { x: (event.clientX - box.left) / factor, y: (event.clientY - box.top) / factor } : null;

    this.commentStart.emit({ variant: row.key, shot, point });
  }

  protected fit() {
    this.canvas.fit();
    this.userCamera$.next(null);
  }

  protected showListTop() {
    if (this.atFit()) this.fit();
    else this.move({ ...this.canvas.pan(), y: 0, zoom: this.shownZoom() });
  }

  protected zoomReset() {
    this.zoomTo(1);
  }

  protected zoomIn() {
    this.zoomTo(this.shownZoom() * ZOOM_STEP);
  }

  protected zoomOut() {
    this.zoomTo(this.shownZoom() / ZOOM_STEP);
  }

  /** Selects the frame with `key` and moves the camera onto it without activating it; `false` when the canvas draws none. */
  public focusFrame(key: string) {
    const frame = this.frames().find((candidate) => candidate.nativeElement.getAttribute('data-sk-frame') === key);

    if (!frame) return false;

    this.selectedFrame.set(key);
    this.focus(frame.nativeElement);

    return true;
  }

  /** Selects the frame with `key`; shows the canvas at 100 % from its head when it is taller than the view, else fits it. `false` when the canvas draws none. */
  public fitFrame(key: string) {
    const frame = this.frames().find((candidate) => candidate.nativeElement.getAttribute('data-sk-frame') === key);

    if (!frame) return false;

    this.selectedFrame.set(key);

    if (this.world().nativeElement.offsetHeight > this.list().nativeElement.clientHeight) {
      this.move({ x: 0, y: 0, zoom: 1 });
    } else {
      this.fit();
    }

    return true;
  }

  protected stackedGridRowOf(block: number | undefined) {
    const lines = this.grid()?.lines.length;

    if (block === undefined || lines === undefined || !this.stacked()) return null;

    const span = 2 + lines * 2;

    return `${block * span + 1} / span ${span}`;
  }

  private lineFactorOf(state: string) {
    const line = this.lineWidths().get(state);

    return line ? this.widest() / line : 1;
  }

  private shownRowsOf(open: boolean) {
    return shownSketchRowsOf({ listed: this.listedRows(), hidden: this.hiddenWithdrawnRows(), open });
  }

  private confirmTargetOf(kind: SketchConfirm) {
    const key = kind === 'merge' ? (this.confirmRow() ?? this.selected() ?? null) : null;
    const row = this.rows().find((candidate) => candidate.key === key) ?? null;
    const origin =
      kind === 'merge'
        ? this.takes().find((take) => take.nativeElement.getAttribute('data-sk-take') === key)?.nativeElement
        : this.head().discardAnchor()?.nativeElement;

    return origin && (kind === 'discard' || row) ? { origin, row } : null;
  }

  private showConfirm(kind: SketchConfirm | null, target: { origin: HTMLElement; row: SketchRow | null } | null) {
    if (kind && this.confirmRef && this.confirmOrigin === target?.origin) return;

    const open = this.confirmRef;

    this.confirmRef = null;
    this.confirmOrigin = null;
    open?.close();

    // The rows render only once the list is measured, so a bound merge confirm waits for its Übernehmen.
    if (!kind || !target) return;

    const { origin, row } = target;
    const repick = kind === 'merge' && row ? (this.repicks()[row.key] ?? null) : null;
    const { label, question, note, confirm } =
      kind === 'discard'
        ? this.LABELS.discardConfirm
        : this.subSketch()
          ? this.LABELS.approveConfirm
          : repick
            ? this.LABELS.repickConfirm
            : this.LABELS.mergeConfirm;
    const text: SketchConfirmText = {
      question: row ? question(row.label ?? this.LABELS.variant(row.key), this.part()) : question(this.part(), ''),
      note,
      confirm,
      ...(repick
        ? {
            lists: [
              { label: this.LABELS.repickConfirm.discards, items: repick.discards },
              ...(repick.keeps.length > 0 ? [{ label: this.LABELS.repickConfirm.keeps, items: repick.keeps }] : []),
            ],
          }
        : {}),
    };
    const ref = this.overlay.open(SketchConfirmComponent, {
      origin,
      role: 'alertdialog',
      ariaLabel: label,
      autoFocus: '[data-sk-confirm-cancel]',
      strategies: anchoredDialogOverlayStrategy(kind === 'merge' ? { placement: 'bottom-start' } : undefined),
      bindings: [
        inputBinding('text', () => text),
        inputBinding('destructive', () => kind === 'discard' || repick !== null),
        outputBinding('confirm', () => {
          ref.close();
          if (row) this.merge.emit(row.key);
          else this.discard.emit();
        }),
      ],
    });

    this.confirmRef = ref;
    this.confirmOrigin = origin;
    ref
      .afterClosed()
      .pipe(
        take(1),
        filter(() => this.confirmRef === ref),
        tap(() => {
          this.confirmRef = null;
          this.confirmOrigin = null;
          this.confirmRow.set(null);
          this.confirm.set(null);
        }),
      )
      .subscribe();
  }

  private fitScaleOf(dom: FitDom) {
    let scale = 1;

    for (let pass = 0; pass < FIT_PASSES; pass++) {
      this.applyScale(
        { scale, note: Math.max(MIN_TEXT, NOTE_TEXT * scale), label: Math.max(MIN_TEXT, LABEL_TEXT * scale) },
        dom,
      );

      const next = dom.matrix ? this.matrixFit({ matrix: dom.matrix, scale }, dom) : this.gridFit(scale, dom);

      if (Math.abs(next - scale) <= FIT_SETTLED) break;

      scale = next;
    }

    return scale;
  }

  private labelsHiddenAt({ scale, label }: { scale: number; label: number }) {
    return label < MIN_LABEL || (this.transposed() && this.widest() * scale < MATRIX_LABEL_MIN);
  }

  private matrixColumnsAt({ columns, blocks }: { columns: number; blocks: number }, scale: number) {
    const frame = `${this.widest() * scale}px`;
    const first = `max-content repeat(${columns}, max(${frame}, ${MATRIX_HEAD_MIN}px))`;
    const later = `max-content repeat(${columns}, ${frame})`;

    return `${[first, ...Array.from({ length: blocks - 1 }, () => later)].join(' ')}${this.screenMode() ? '' : ' auto'}`;
  }

  private matrixHeightFit({ matrix, scale }: { matrix: HTMLElement; scale: number }, { gutters, list }: FitDom) {
    const lines = new Map<string, number>();

    for (const gutter of gutters) {
      const block = gutter.dataset['skBlock'] ?? '0';

      lines.set(block, (lines.get(block) ?? 0) + gutter.offsetHeight);
    }

    const tallest = Math.max(0, ...lines.values());
    const room = list.clientHeight - FIT_PADDING - (matrix.offsetHeight - tallest);

    return tallest > 0 && room > 0 ? (room * scale) / tallest : Infinity;
  }

  private matrixFit({ matrix, scale }: { matrix: HTMLElement; scale: number }, dom: FitDom) {
    const { columns, blocks, list, sections, gutters, fold } = dom;
    const first = sections[0];
    const lead = first ? first.getBoundingClientRect().left - matrix.getBoundingClientRect().left : 0;
    const shown = Math.max(1, columns);
    const foldWidth = fold ? fold.offsetWidth + COLUMN_GAP : 0;
    const widths = new Map<string, number>();

    for (const gutter of gutters) {
      const block = gutter.dataset['skBlock'] ?? '0';

      widths.set(block, Math.max(widths.get(block) ?? 0, gutter.offsetWidth));
    }

    const later = [...widths].reduce((sum, [block, width]) => sum + (block === '0' ? 0 : width + COLUMN_GAP * 2), 0);

    const widthFit = matrixWidthFit({
      room: list.clientWidth - lead - later - foldWidth - blocks * (shown - 1) * COLUMN_GAP - FIT_PADDING,
      columns: shown,
      blocks,
      frameWidth: this.widest(),
    });
    const heightFit = this.matrixHeightFit({ matrix, scale }, dom);

    return Math.min(1, Math.max(Math.min(widthFit, heightFit), MATRIX_MIN_COLUMN / this.widest()));
  }

  private applyScale(
    { scale, note, label }: { scale: number; note: number; label: number },
    { columns, blocks, stages, frames, frameSizes, notes, labels, labelRows, gutters, matrix }: FitDom,
  ) {
    const { setStyle } = this.renderer;

    for (const gutter of gutters) setStyle(gutter, { fontSize: `${note}px` });
    if (matrix) {
      setStyle(matrix, {
        gridTemplateColumns: this.matrixColumnsAt({ columns, blocks }, scale),
      });
    }

    for (const element of notes) setStyle(element, { fontSize: `${note}px` });
    for (const element of labels) setStyle(element, { fontSize: `${label}px` });
    for (const row of labelRows) this.renderer.toggleClass(row, 'hidden', this.labelsHiddenAt({ scale, label }));
    for (const stage of stages) {
      const inner = frames.find((frame) => stage.contains(frame))?.firstElementChild;
      const row = this.grid() ? this.shownRows().find((shown) => shown.key === stage.dataset['skStageRow']) : undefined;

      if (row) {
        setStyle(stage, { gridTemplateColumns: this.gridOf(row, scale) });
      } else if (inner instanceof HTMLElement) {
        setStyle(stage, {
          gridTemplateColumns: `repeat(${columns}, minmax(${parseFloat(inner.style.width) * scale}px, max-content))`,
        });
      }
    }
    const states = this.frameStates();

    frames.forEach((frame, index) => {
      const size = frameSizes[index];
      const state = states.get(frame.dataset['skFrame'] ?? '');
      const line = state === undefined ? scale : this.lineScaleOf(state, scale);

      if (size) setStyle(frame, { width: `${size.width * line}px`, height: `${size.height * line}px` });
    });
  }

  private sideBySideWidthFit({
    columns,
    list,
    sections,
    stages,
  }: Pick<FitDom, 'columns' | 'list' | 'sections' | 'stages'>) {
    const first = sections[0];
    const last = sections.at(-1);

    if (!first || !last) return 1;

    const span = last.getBoundingClientRect().right - first.getBoundingClientRect().left;
    const shown = stages.filter((stage) => sections.some((section) => section.contains(stage)));
    const stageWidths = shown.reduce((sum, stage) => sum + stage.clientWidth, 0);
    const gaps = sections.length * (columns - 1) * this.columnGap();
    const room = list.clientWidth - (span - stageWidths) - gaps;

    if (this.grid()) {
      const lead = first.parentElement
        ? first.getBoundingClientRect().left - first.parentElement.getBoundingClientRect().left
        : 0;

      const widths = this.changedRows().map((row) => gridColumnWidthOf(row));
      const scale = gridScaleOf({
        room: room - lead - FIT_PADDING,
        columns: widths,
        heads: this.headWidthsOf(shown[0], columns),
      });

      return Math.max(scale, MATRIX_MIN_COLUMN / Math.max(1, ...widths));
    }

    const frames = this.changedRows().reduce((sum, row) => sum + row.width * columns, 0);

    return room / frames;
  }

  private headWidthsOf(stage: HTMLElement | undefined, columns: number) {
    const parts = this.columnHeadParts()
      .map(({ nativeElement }) => nativeElement)
      .filter((part) => stage?.contains(part));

    return Array.from({ length: columns }, (_, index) =>
      Math.max(
        0,
        ...parts.filter((part) => part.dataset['skHeadColumn'] === `${index}`).map((part) => part.offsetWidth),
      ),
    );
  }

  private variantRoomOf(
    { list, sections }: Pick<FitDom, 'list' | 'sections'>,
    { count, columns }: { count: number; columns: number },
  ) {
    const section = sections[0];

    if (!section) return list.clientWidth;

    const style = getComputedStyle(section);
    const chrome = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const gap = section.parentElement ? parseFloat(getComputedStyle(section.parentElement).columnGap) || 0 : 0;
    const lead = this.grid() ? (this.lineHeads()[0]?.nativeElement.offsetWidth ?? 0) + gap : 0;

    return (
      list.clientWidth - FIT_PADDING - lead - count * (chrome + (columns - 1) * this.columnGap()) - (count - 1) * gap
    );
  }

  private stackedOf(dom: FitDom) {
    const rows = this.changedRows();

    if (this.transposed() || rows.length < 2) return false;

    const grid = !!this.grid();

    return variantsStackedOf({
      room: this.variantRoomOf(dom, { count: rows.length, columns: dom.columns }),
      columns: rows.map((row) => (grid ? gridColumnWidthOf(row) : row.width)),
      heads: grid ? this.headWidthsOf(dom.stages[0], dom.columns) : Array.from({ length: dom.columns }, () => 0),
      minColumn: grid ? MATRIX_MIN_COLUMN : 0,
    });
  }

  private stackedGridFit(dom: FitDom) {
    const widest = Math.max(1, ...this.changedRows().map((row) => gridColumnWidthOf(row)));
    const scale = gridScaleOf({
      room: this.variantRoomOf(dom, { count: 1, columns: dom.columns }),
      columns: [widest],
      heads: this.headWidthsOf(dom.stages[0], dom.columns),
    });

    return Math.max(scale, MATRIX_MIN_COLUMN / widest);
  }

  private gridFit(scale: number, dom: FitDom) {
    const { columns, list, sections, stages, frames } = dom;
    const stage = stages[0];
    const side = this.sideBySide();
    const changed = sections.slice(0, this.changedRows().length);
    const widthFit = side
      ? this.sideBySideWidthFit({ columns, list, sections: changed, stages })
      : this.stacked() && this.grid()
        ? this.stackedGridFit(dom)
        : stage
          ? (stage.clientWidth - (columns - 1) * COLUMN_GAP) / (columns * this.widest())
          : 1;
    const groups = side || this.stacked() ? changed.map((section) => [section]) : [sections.slice(0, 2)];
    const heightFits = groups.flatMap((measured) => {
      const first = measured[0];
      const last = measured.at(-1);

      if (!first || !last) return [];

      const lines = new Map<number, number>();

      for (const frame of frames) {
        if (!measured.some((section) => section.contains(frame))) continue;

        const box = frame.getBoundingClientRect();
        const top = Math.round(box.top);

        lines.set(top, Math.max(lines.get(top) ?? 0, box.height));
      }

      const framesHeight = [...lines.values()].reduce((sum, height) => sum + height, 0);
      const total = last.getBoundingClientRect().bottom - first.getBoundingClientRect().top;
      const room = list.clientHeight - FIT_PADDING - (total - framesHeight);

      return [framesHeight > 0 && room > 0 ? (room * scale) / framesHeight : Infinity];
    });

    return Math.min(1, widthFit, ...heightFits);
  }

  private shownZoom() {
    const zoom = this.canvas.zoom();
    const row = this.shownRows().find((candidate) => candidate.shots.length > 0);

    return zoom === 'fit' ? (row || this.transposed() ? this.scale() : 1) : zoom;
  }

  private zoomTo(zoom: number) {
    this.move({ ...this.canvas.pan(), zoom });
  }

  private move(camera: Camera) {
    this.gesture$.next();
    this.userCamera$.next(this.canvas.move(camera, this.shownZoom()));
  }

  private show(target: CameraTarget, pressed: HTMLElement | null) {
    if (target.kind === 'all') this.fit();
    else if (target.kind === 'visible') this.zoomReset();
    else {
      this.focus(pressed);
      this.frameActivate.emit(pressed?.dataset['skFrame'] ?? null);
    }
  }

  private focus(frame: HTMLElement | null) {
    const list = this.list().nativeElement;

    if (!frame || !list.contains(frame)) return;

    const box = frame.getBoundingClientRect();
    const state = this.frameStates().get(frame.dataset['skFrame'] ?? '');
    const zoom = state === undefined ? this.shownZoom() : this.lineScaleOf(state, this.shownZoom());
    const shown = Math.min(
      (list.clientWidth - FOCUS_PADDING * 2) / (box.width / zoom),
      (list.clientHeight - FOCUS_PADDING * 2) / (box.height / zoom),
    );

    this.zoomTo(state === undefined || !this.transposed() || shown > 1 ? shown : shown / this.lineFactorOf(state));
    afterNextRender(
      {
        write: () => {
          const moved = frame.getBoundingClientRect();
          const view = list.getBoundingClientRect();
          const { x, y } = this.canvas.pan();

          this.move({
            x: x + view.left + FOCUS_PADDING - moved.left,
            y: y + view.top + FOCUS_PADDING - moved.top,
            zoom: this.shownZoom(),
          });
        },
      },
      { injector: this.injector },
    );
  }
}
