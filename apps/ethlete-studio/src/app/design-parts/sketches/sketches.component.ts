import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
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
import { debounceTime, distinctUntilChanged, filter, from, map, Subject, tap } from 'rxjs';
import {
  anchoredDialogOverlayStrategy,
  BADGE_IMPORTS,
  BUTTON_IMPORTS,
  CHOICE_FIELD_IMPORTS,
  FORM_FIELD_IMPORTS,
  SELECT_IMPORTS,
  SWITCH_IMPORTS,
  injectOverlayManager,
  TOOLTIP_IMPORTS,
} from '@ethlete/components';
import {
  ProvideColorDirective,
  injectRenderer,
  injectSemanticColorTheme,
  signalElementDimensions,
} from '@ethlete/core';
import { CameraTarget } from '../../components/design-canvas/canvas-camera';
import { Camera } from '../../components/design-canvas/canvas-math';
import { FrameZoom, frameZoomCamera } from '../../components/design-canvas/frame-zoom-camera';
import { mountFrameZoomViewport } from '../../components/design-canvas/frame-zoom-viewport';
import { CanvasViewportComponent } from '../canvas-viewport/canvas-viewport.component';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { SketchDiscardConfirmComponent } from './sketch-discard-confirm.component';
import { AgentLogoComponent } from '../../icons/agent-logo.component';
import { CommentPinComponent } from '../comment-pin/comment-pin.component';
import { DisclosureComponent } from '../disclosure/disclosure.component';
import { PartTreeComponent } from '../part-tree/part-tree.component';
import { SHELL_SAMPLE, ShellAction, ShellPageComponent, ShellState } from '../shell-main/shell-page.component';
import { ZoomChipComponent } from '../zoom-chip/zoom-chip.component';
import { OpenPointsChipComponent } from '../system-page/open-points-chip.component';
import { OpenPointGroup, OpenPointTarget } from '../system-page/system-page-sample';
import { cropGroupsOf, magnifyTextOf, SketchCropGroup } from './sketch-crops';
import {
  SKETCH_CURRENT,
  SKETCH_DRAWN,
  SKETCH_HOLD,
  SKETCH_IDLE,
  SKETCH_PINS,
  SKETCH_ROUNDS,
  SKETCH_ROWS,
  SKETCH_TREE,
  SketchHold,
  SketchIdle,
  SketchPin,
  SketchRow,
  SketchWithdrawn,
  SketchShot,
  SketchStatus,
} from './sketches-sample';

export type SketchMergeHold = { reason: string; dirty?: string[] };

export type SketchShotContext = { $implicit: SketchRow; state: string };

const ZOOM_STEP = 1.5;

const statesOf = (rows: readonly SketchRow[]) => [
  ...new Set(rows.flatMap((row) => row.shots.map((shot) => shot.state))),
];

const EDIT_ROW_LABELS: Record<string, string> = {
  old: STUDIO_LABELS.sketches.editOld,
  new: STUDIO_LABELS.sketches.editNew,
};

const isBaseRow = (row: SketchRow) => row.key === SKETCH_CURRENT || row.key === 'old' || row.key === 'new';

/**
 * The states every variant row draws the same as Current (`changed === false`); a state still compared (`null`) never
 * folds, and none folds when every state would.
 */
export const foldedStatesOf = (rows: readonly SketchRow[]): ReadonlySet<string> => {
  const variants = rows.filter((row) => !isBaseRow(row));
  const states = statesOf(rows);
  const folded = states.filter(
    (state) =>
      variants.length > 0 &&
      variants.every((row) => row.shots.some((shot) => shot.state === state && shot.changed === false)),
  );

  return new Set(folded.length < states.length ? folded : []);
};

/** The states Current and every variant row draw: all of them while `open`, else only the ones a variant changes. */
export const shownStatesOf = (rows: readonly SketchRow[], open: boolean): string[] => {
  const folded = open ? new Set<string>() : foldedStatesOf(rows);

  return statesOf(rows).filter((state) => !folded.has(state));
};

const WRAP_WIDTH = 1440;

const MAX_COLUMNS = 4;

const TRANSPOSE_SHARE = 4;

const COLUMN_GAP = 24;

const FOCUS_PADDING = 24;

const MIN_TEXT = 12;

const NOTE_TEXT = 15;

const HEAD_WIDTH = 288;

const LABEL_TEXT = 13;

const MIN_LABEL = 9;

const FIT_PADDING = 16;

const FIT_PASSES = 6;

const FIT_SETTLED = 0.002;

type FitDom = {
  columns: number;
  list: HTMLElement;
  sections: HTMLElement[];
  stages: HTMLElement[];
  frames: HTMLElement[];
  notes: HTMLElement[];
  labels: HTMLElement[];
  labelRows: HTMLElement[];
  gutters: HTMLElement[];
  matrix: HTMLElement | null;
  fold: HTMLElement | null;
};

const frameKeyOf = (row: SketchRow, state: string) => `${row.key} ${state}`;

const zoomOf = (camera: 'fit' | '100' | Camera): FrameZoom =>
  camera === 'fit' ? 'fit' : camera === '100' ? 1 : camera.zoom;

const textAt = (size: number, { scale, fit }: { scale: number; fit: number }) => {
  const floor = Math.max(MIN_TEXT, size * fit);

  return scale >= fit ? Math.max(MIN_TEXT, size * scale) : (floor * scale) / fit;
};

const isWithdrawn = (row: SketchRow) => row.withdrawn !== undefined;

const isPending = (row: SketchRow) => row.shots.some((shot) => shot.changed === null);

@Component({
  selector: 'ethlete-sketches',
  templateUrl: './sketches.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    BADGE_IMPORTS,
    BUTTON_IMPORTS,
    ProvideColorDirective,
    FORM_FIELD_IMPORTS,
    SELECT_IMPORTS,
    CHOICE_FIELD_IMPORTS,
    SWITCH_IMPORTS,
    TOOLTIP_IMPORTS,
    NgTemplateOutlet,
    AgentLogoComponent,
    CanvasViewportComponent,
    CommentPinComponent,
    DisclosureComponent,
    PartTreeComponent,
    ShellPageComponent,
    ZoomChipComponent,
    OpenPointsChipComponent,
  ],
  host: { class: 'block h-screen w-full' },
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
  public heading = input<string | null>(null);
  public rows = input<SketchRow[]>(SKETCH_ROWS);
  public fresh = input(false);
  public status = input<SketchStatus>('waiting');
  public openPoints = input<OpenPointGroup[]>([]);
  public pointsClosed = model(true);
  public errored = input<readonly string[]>([]);
  public mergeHold = input<SketchMergeHold | null>(null);
  public drawn = input<string | null>(SKETCH_DRAWN);
  public hold = input<SketchHold>(SKETCH_HOLD);
  public idle = input<SketchIdle>(SKETCH_IDLE);
  public reason = input(false);
  public rounds = input(SKETCH_ROUNDS);
  public round = input(SKETCH_ROUNDS[0]?.value ?? '');
  public pins = input<SketchPin[]>(SKETCH_PINS);
  public sameOpen = model(false);
  public statesOpen = model(false);
  public withdrawn = model<SketchWithdrawn>('hidden');
  public wholeScreens = model<readonly string[]>([]);

  public shot = input<TemplateRef<SketchShotContext> | null>(null);
  public tree = input(SKETCH_TREE);
  public error = input<string | null>(null);
  public listError = input<string | null>(null);
  public retry = output();
  public shellAction = output<ShellAction>();
  public discard = output();
  public merge = output<string>();
  public roundChange = output<string>();

  public pinToggle = output<string>();
  public pick = output<string>();
  public expandedChange = output<readonly string[]>();
  public cameraChange = output<Camera | null>();
  public listWidthChange = output<number>();
  public openPoint = output<OpenPointTarget>();
  private list = viewChild.required('list', { read: ElementRef<HTMLElement> });
  private world = viewChild.required('world', { read: ElementRef<HTMLElement> });
  private matrix = viewChild('matrix', { read: ElementRef<HTMLElement> });

  private fold = viewChild('fold', { read: ElementRef<HTMLElement> });
  private stages = viewChildren('stage', { read: ElementRef<HTMLElement> });
  private sections = viewChildren('section', { read: ElementRef<HTMLElement> });
  private frames = viewChildren('frame', { read: ElementRef<HTMLElement> });
  private gutters = viewChildren('gutter', { read: ElementRef<HTMLElement> });
  private notes = viewChildren('note', { read: ElementRef<HTMLElement> });
  private labels = viewChildren('stateLabel', { read: ElementRef<HTMLElement> });
  private labelRows = viewChildren('labelRow', { read: ElementRef<HTMLElement> });
  private listSize = signalElementDimensions(this.list);

  protected readonly LABELS = STUDIO_LABELS.sketches;
  protected readonly IS_WITHDRAWN = isWithdrawn;
  protected readonly CURRENT = SKETCH_CURRENT;
  protected readonly COLUMN_GAP = COLUMN_GAP;
  protected readonly FRAME_KEY_OF = frameKeyOf;
  protected readonly STACK_INSETS = [32, 64];

  protected canvas = frameZoomCamera(() => {
    const camera = this.camera();

    return this.restoredCamera() ?? (typeof camera === 'object' ? camera : { x: 0, y: 0, zoom: zoomOf(camera) });
  });
  protected reasonOpen = linkedSignal(() => this.reason());
  protected selectedFrame = signal<string | null>(null);
  private fitAt = signal<number | null>(null);
  private fontsReady = toSignal(from(this.document.fonts.ready).pipe(map(() => true)), { initialValue: false });
  private userCamera$ = new Subject<Camera | null>();
  protected withdrawnCount = computed(() => this.rows().filter(isWithdrawn).length);
  private isEdit = computed(() => this.part().endsWith('@edit'));
  private listedRows = computed(() => {
    const edit = this.isEdit();
    const rows = this.rows().filter(
      (row) =>
        !((this.fresh() || edit) && row.key === SKETCH_CURRENT) && (this.withdrawn() === 'shown' || !isWithdrawn(row)),
    );

    return edit ? rows.map((row) => ({ ...row, label: EDIT_ROW_LABELS[row.key] ?? row.label })) : rows;
  });
  protected foldedStates = computed(() => foldedStatesOf(this.listedRows()));
  public shownRows = computed(() => {
    const rows = this.listedRows();
    const shown = new Set(shownStatesOf(rows, this.statesOpen()));

    if (shown.size === statesOf(rows).length) return rows;

    return rows
      .map((row) => ({ ...row, shots: row.shots.filter((shot) => shown.has(shot.state)) }))
      .filter((row) => shown.size > 0 || row.key !== SKETCH_CURRENT);
  });
  protected discardable = computed(() => !this.isEdit());
  protected question = computed(() => this.rounds().find((option) => option.value === this.round())?.note ?? '');
  public columns = computed(() => {
    const rows = this.shownRows();
    const widest = Math.max(1, ...rows.map((row) => row.width));
    const most = Math.max(1, ...rows.map((row) => row.shots.length));

    return Math.max(1, Math.min(MAX_COLUMNS, most, Math.floor(WRAP_WIDTH / widest)));
  });
  private widest = computed(() => Math.max(1, ...this.shownRows().map((row) => row.width)));
  private listWidth = computed(() => this.listSize().client?.width ?? 0);
  protected listMeasured = computed(() => this.listWidth() > 0);
  private sizedWidest = computed(() =>
    Math.max(0, ...this.shownRows().flatMap((row) => (row.sized === false ? [] : [row.width]))),
  );
  public transposed = computed(() => this.listWidth() > 0 && this.sizedWidest() > this.listWidth() / TRANSPOSE_SHARE);
  private cropGroups = computed(() => (this.transposed() ? cropGroupsOf(this.shownRows()) : []));
  protected groupOfState = computed(
    () => new Map(this.cropGroups().flatMap((group) => group.states.map((state) => [state, group] as const))),
  );
  protected matrixStates = computed(() => {
    const groups = this.groupOfState();

    return [...new Set(this.shownRows().flatMap((row) => row.shots.map((shot) => shot.state)))].filter(
      (state) => (groups.get(state)?.states[0] ?? state) === state,
    );
  });
  private fitScale = computed(() => this.fitAt() ?? 1);

  protected scale = computed(() => {
    const zoom = this.canvas.zoom();

    return zoom === 'fit' ? this.fitScale() : zoom;
  });
  // A user zoom holds the fit the labels were sized at: a new fit from a wider viewport would resize the gutter and head
  // columns and move every frame on screen.
  private noteFit = linkedSignal<{ zoom: FrameZoom; fit: number | null }, number>({
    source: () => ({ zoom: this.canvas.zoom(), fit: this.fitAt() }),
    computation: ({ zoom, fit }, previous) =>
      zoom === 'fit' || fit === null || previous?.source.fit === null || previous?.source.zoom !== zoom
        ? (fit ?? 1)
        : previous.value,
  });
  protected noteSize = computed(() => textAt(NOTE_TEXT, { scale: this.scale(), fit: this.noteFit() }));
  protected headHidden = computed(() => this.noteSize() < MIN_LABEL);
  protected headColumns = computed(() =>
    this.headHidden() ? 'max-content minmax(0, 1fr)' : `${(HEAD_WIDTH * this.noteSize()) / NOTE_TEXT}px minmax(0, 1fr)`,
  );
  protected labelFont = computed(() => textAt(LABEL_TEXT, { scale: this.scale(), fit: this.noteFit() }));
  protected labelSize = computed(() => (this.labelFont() < MIN_LABEL ? null : this.labelFont()));
  protected shownStatus = computed(() =>
    this.errored().length > 0 && (this.status() === 'waiting' || this.status() === 'idle') ? 'errored' : this.status(),
  );

  protected drawnKey = computed(() => (this.status() === 'drawing' ? this.drawn() : null));
  protected sameRows = linkedSignal<
    { part: string; rows: SketchRow[]; listed: SketchRow[]; drawn: string | null },
    SketchRow[]
  >({
    source: () => ({ part: this.part(), rows: this.shownRows(), listed: this.listedRows(), drawn: this.drawnKey() }),
    computation: ({ part, rows, listed, drawn }, previous) => {
      const wasSame = new Set(previous?.source.part === part ? previous.value.map((row) => row.key) : []);
      const shotsOf = (key: string) => listed.find((row) => row.key === key)?.shots ?? [];

      return rows.filter(
        (row) =>
          !isBaseRow(row) &&
          row.key !== drawn &&
          shotsOf(row.key).length > 0 &&
          shotsOf(row.key).every((shot) => shot.changed === false || (shot.changed === null && wasSame.has(row.key))),
      );
    },
  });
  protected changedRows = computed(() => {
    const same = this.sameRows();

    return this.shownRows().filter((row) => !same.includes(row));
  });
  protected sameKeys = computed(
    () =>
      new Set(
        this.listedRows()
          .filter((row) => !isBaseRow(row) && row.shots.length > 0 && row.shots.every((shot) => shot.changed === false))
          .map((row) => row.key),
      ),
  );
  protected heldMerge = computed(() => {
    const variants = this.listedRows().filter((row) => !isBaseRow(row));
    const same = this.sameKeys();

    return variants.length > 0 && variants.every((row) => same.has(row.key)) ? this.mergeHold() : null;
  });
  protected sameLabel = computed(() => this.LABELS.sameVariants(this.sameRows().map((row) => row.label ?? row.key)));
  protected matrixRows = computed(() =>
    this.sameOpen() ? [...this.changedRows(), ...this.sameRows()] : this.changedRows(),
  );
  protected matrixTop = computed(() => (this.sameRows().length > 0 && this.sameOpen() ? 2 : 1));
  protected sameColumn = computed(() => this.changedRows().length + 2);
  protected matrixColumns = computed(
    () => `max-content repeat(${this.matrixRows().length}, ${this.widest() * this.scale()}px) auto`,
  );
  protected percent = computed(() => {
    return Math.round(this.shownZoom() * 100);
  });

  constructor() {
    afterNextRender(() => {
      const teardown = mountFrameZoomViewport({
        viewport: this.list().nativeElement,
        frameSelector: '[data-sk-frame]',
        camera: () => ({ ...this.canvas.pan(), zoom: this.shownZoom() }),
        move: (camera) => this.move(camera),
        show: (target, frame) => this.show(target, frame),
        select: (frame) => this.selectedFrame.set(frame.dataset['skFrame'] ?? null),
        afterRender: (write) => afterNextRender({ write }, { injector: this.injector }),
      });

      this.destroyRef.onDestroy(teardown);
    });

    afterRenderEffect(() => {
      this.fontsReady();
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
      const list: HTMLElement = this.list().nativeElement;
      const elementsOf = (refs: readonly ElementRef<HTMLElement>[]) => refs.map(({ nativeElement }) => nativeElement);
      const dom: FitDom = {
        columns: this.transposed() ? this.matrixRows().length : this.columns(),
        list,
        sections: elementsOf(this.sections()),
        stages: elementsOf(this.stages()),
        frames: elementsOf(this.frames()),
        notes: elementsOf(this.notes()),
        labels: elementsOf(this.labels()),
        labelRows: elementsOf(this.labelRows()),
        gutters: elementsOf(this.gutters()),
        matrix: this.matrix()?.nativeElement ?? null,
        fold: this.fold()?.nativeElement ?? null,
      };

      untracked(() => {
        this.fitAt.set(this.fitScaleOf(dom));
        this.applyScale({ scale: this.scale(), note: this.noteSize(), label: this.labelFont() }, dom);
      });
    });

    afterRenderEffect({
      read: () => {
        this.listSize();
        this.scale();
        this.noteSize();
        this.shownRows();
        this.matrixRows();
        this.canvas.measure(this.list().nativeElement, this.world().nativeElement);
      },
    });

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
        debounceTime(500),
        distinctUntilChanged(),
        tap((width) => this.listWidthChange.emit(width)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected gridOf(row: SketchRow) {
    return `repeat(${this.columns()}, ${row.width * this.scale()}px)`;
  }

  protected matrixLineOf(state: string) {
    return `${this.matrixTop() + 1 + this.matrixStates().indexOf(state) * 2} / span 2`;
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

  protected shownHeightOf(row: SketchRow, item: SketchShot) {
    const crop = this.croppedOf(item.state)?.crop;

    return crop ? (row.width * crop.height) / crop.width : item.height;
  }

  protected cropTransformOf(row: SketchRow, state: string) {
    const group = this.croppedOf(state);

    if (!group) return null;

    const unit = row.width / group.change.width;

    return `scale(${group.magnify}) translate(${-group.crop.x * unit}px, ${-group.crop.y * unit}px)`;
  }

  protected markOf(row: SketchRow, item: SketchShot) {
    const change = this.groupOfState().get(item.state) ? item.change : undefined;

    if (!change) return null;

    const unit = row.width / change.width;

    return {
      left: change.box.x * unit - 4,
      top: change.box.y * unit - 4,
      width: change.box.width * unit + 8,
      height: change.box.height * unit + 8,
    };
  }

  protected locatorOf(group: SketchCropGroup) {
    const percent = (part: number, whole: number) => `${(part / whole) * 100}%`;

    return {
      left: percent(group.crop.x, group.change.width),
      top: percent(group.crop.y, group.change.height),
      width: percent(group.crop.width, group.change.width),
      height: percent(group.crop.height, group.change.height),
      ratio: `${group.change.width} / ${group.change.height}`,
    };
  }

  protected magnifyTextOf(group: SketchCropGroup) {
    return magnifyTextOf(group.magnify);
  }

  protected withdrawnMarkOf(reason: string) {
    return reason ? STUDIO_LABELS.systemTree.withdrawnWith(reason) : STUDIO_LABELS.systemTree.withdrawnLabel;
  }

  protected isSame(row: SketchRow, unchanged: boolean | null) {
    return !isBaseRow(row) && unchanged === false && !isPending(row);
  }

  protected isPending(row: SketchRow) {
    return row.key !== SKETCH_CURRENT && isPending(row);
  }

  protected firstChangeOf(row: SketchRow) {
    return isBaseRow(row) || isPending(row) ? null : (row.shots.find((shot) => shot.changed === true)?.state ?? null);
  }

  protected pinOf(key: string) {
    return this.pins().find((pin) => pin.variant === key);
  }

  protected confirmDiscard(event: MouseEvent) {
    const ref = this.overlay.open(SketchDiscardConfirmComponent, {
      origin: event,
      role: 'alertdialog',
      ariaLabel: this.LABELS.discardConfirm.label,
      autoFocus: '[data-sk-discard-cancel]',
      strategies: anchoredDialogOverlayStrategy(),
      bindings: [
        inputBinding('part', this.part),
        outputBinding('confirm', () => {
          ref.close();
          this.discard.emit();
        }),
      ],
    });
  }

  protected selectRound(value: unknown) {
    if (typeof value === 'string') this.roundChange.emit(value);
  }

  protected toggleReason() {
    this.reasonOpen.update((open) => !open);
  }

  protected fit() {
    this.canvas.fit();
    this.userCamera$.next(null);
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

  private fitScaleOf(dom: FitDom) {
    let scale = 1;

    for (let pass = 0; pass < FIT_PASSES; pass++) {
      this.applyScale(
        { scale, note: Math.max(MIN_TEXT, NOTE_TEXT * scale), label: Math.max(MIN_TEXT, LABEL_TEXT * scale) },
        dom,
      );

      const next = dom.matrix ? this.matrixFit(dom.matrix, dom) : this.gridFit(scale, dom);

      if (Math.abs(next - scale) <= FIT_SETTLED) break;

      scale = next;
    }

    return scale;
  }

  private matrixFit(matrix: HTMLElement, { columns, list, sections, fold }: FitDom) {
    const first = sections[0];
    const lead = first ? first.getBoundingClientRect().left - matrix.getBoundingClientRect().left : 0;
    const shown = Math.max(1, columns);
    const foldWidth = fold ? fold.offsetWidth + COLUMN_GAP : 0;

    return Math.min(
      1,
      (list.clientWidth - lead - foldWidth - (shown - 1) * COLUMN_GAP - FIT_PADDING) / (shown * this.widest()),
    );
  }

  private applyScale(
    { scale, note, label }: { scale: number; note: number; label: number },
    { columns, sections, stages, frames, notes, labels, labelRows, gutters, matrix }: FitDom,
  ) {
    const { setStyle } = this.renderer;

    for (const gutter of gutters) setStyle(gutter, { fontSize: `${note}px` });
    if (matrix) {
      setStyle(matrix, {
        gridTemplateColumns: `max-content repeat(${columns}, ${this.widest() * scale}px) auto`,
      });
    }

    for (const section of matrix ? [] : sections) {
      setStyle(section, { gridTemplateColumns: `${(HEAD_WIDTH * note) / NOTE_TEXT}px minmax(0, 1fr)` });
    }
    for (const element of notes) setStyle(element, { fontSize: `${note}px` });
    for (const element of labels) setStyle(element, { fontSize: `${label}px` });
    for (const row of labelRows) this.renderer.toggleClass(row, 'hidden', label < MIN_LABEL);
    for (const stage of stages) {
      const inner = frames.find((frame) => stage.contains(frame))?.firstElementChild;

      if (inner instanceof HTMLElement) {
        setStyle(stage, { gridTemplateColumns: `repeat(${columns}, ${parseFloat(inner.style.width) * scale}px)` });
      }
    }
    for (const frame of frames) {
      const inner = frame.firstElementChild;

      if (inner instanceof HTMLElement) {
        setStyle(frame, {
          width: `${parseFloat(inner.style.width) * scale}px`,
          height: `${parseFloat(inner.style.height) * scale}px`,
        });
      }
    }
  }

  private gridFit(scale: number, { columns, list, sections, stages, frames }: FitDom) {
    const stage = stages[0];
    const widthFit = stage ? (stage.clientWidth - (columns - 1) * COLUMN_GAP) / (columns * this.widest()) : 1;
    const measured = sections.slice(0, 2);
    const first = measured[0];
    const last = measured.at(-1);

    if (!first || !last) return Math.min(1, widthFit);

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
    const heightFit = framesHeight > 0 && room > 0 ? (room * scale) / framesHeight : Infinity;

    return Math.min(1, widthFit, heightFit);
  }

  private shownZoom() {
    const zoom = this.canvas.zoom();
    const row = this.shownRows().find((candidate) => candidate.key !== this.drawnKey() && candidate.shots.length > 0);

    return zoom === 'fit' ? (row ? this.scale() : 1) : zoom;
  }

  private zoomTo(zoom: number) {
    this.move({ ...this.canvas.pan(), zoom });
  }

  private move(camera: Camera) {
    this.userCamera$.next(this.canvas.move(camera, this.shownZoom()));
  }

  private show(target: CameraTarget, pressed: HTMLElement | null) {
    if (target.kind === 'all') this.fit();
    else if (target.kind === 'visible') this.zoomReset();
    else this.focus(pressed);
  }

  private focus(frame: HTMLElement | null) {
    const list = this.list().nativeElement;

    if (!frame || !list.contains(frame)) return;

    const box = frame.getBoundingClientRect();
    const zoom = this.shownZoom();

    this.zoomTo(
      Math.min(
        (list.clientWidth - FOCUS_PADDING * 2) / (box.width / zoom),
        (list.clientHeight - FOCUS_PADDING * 2) / (box.height / zoom),
      ),
    );
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
