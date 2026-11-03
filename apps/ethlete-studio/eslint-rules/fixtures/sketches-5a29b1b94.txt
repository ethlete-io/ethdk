import { NgTemplateOutlet } from '@angular/common';
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
  linkedSignal,
  output,
  signal,
  TemplateRef,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, Subject, tap } from 'rxjs';
import { BADGE_IMPORTS, BUTTON_IMPORTS, FORM_FIELD_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';
import {
  ProvideColorDirective,
  injectRenderer,
  injectSemanticColorTheme,
  signalElementDimensions,
} from '@ethlete/core';
import { CameraTarget } from '../../components/design-canvas/canvas-camera';
import { Camera, clampZoom } from '../../components/design-canvas/canvas-math';
import { mountFrameZoomViewport } from '../../components/design-canvas/frame-zoom-viewport';
import { CanvasViewportComponent } from '../canvas-viewport/canvas-viewport.component';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { AgentLogoComponent } from '../../icons/agent-logo.component';
import { CommentPinComponent } from '../comment-pin/comment-pin.component';
import { PartTreeComponent } from '../part-tree/part-tree.component';
import { SHELL_SAMPLE, ShellAction, ShellPageComponent, ShellState } from '../shell-main/shell-page.component';
import { ZoomChipComponent } from '../zoom-chip/zoom-chip.component';
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
  SketchStatus,
} from './sketches-sample';

type Zoom = 'fit' | number;

export type SketchShotContext = { $implicit: SketchRow; state: string };

const ZOOM_STEP = 1.5;

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
};

const frameKeyOf = (row: SketchRow, state: string) => `${row.key} ${state}`;

const zoomOf = (camera: 'fit' | '100' | Camera): Zoom =>
  camera === 'fit' ? 'fit' : camera === '100' ? 1 : camera.zoom;

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
    NgTemplateOutlet,
    AgentLogoComponent,
    CanvasViewportComponent,
    CommentPinComponent,
    PartTreeComponent,
    ShellPageComponent,
    ZoomChipComponent,
  ],
  host: { class: 'block h-screen w-full' },
})
export class SketchesComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private renderer = injectRenderer();
  public shell = input<ShellState>(SHELL_SAMPLE);
  public camera = input<'fit' | '100' | Camera>('fit');
  public restoredCamera = input<Camera | null>(null);
  public selected = input<string | undefined>(undefined);
  public part = input('components/title-bar');
  public rows = input<SketchRow[]>(SKETCH_ROWS);
  public fresh = input(false);
  public status = input<SketchStatus | undefined>(undefined);
  public drawn = input<string | null>(SKETCH_DRAWN);
  public hold = input<SketchHold>(SKETCH_HOLD);
  public idle = input<SketchIdle>(SKETCH_IDLE);
  public reason = input(false);
  public rounds = input(SKETCH_ROUNDS);
  public round = input(SKETCH_ROUNDS[0]?.value ?? '');
  public pins = input<SketchPin[]>(SKETCH_PINS);

  public shot = input<TemplateRef<SketchShotContext> | null>(null);
  public tree = input(SKETCH_TREE);
  public error = input<string | null>(null);
  public shellAction = output<ShellAction>();
  public discard = output();
  public merge = output<string>();
  public roundChange = output<string>();

  public pinToggle = output<string>();
  public pick = output<string>();
  public expandedChange = output<readonly string[]>();
  public cameraChange = output<Camera | null>();
  private list = viewChild.required('list', { read: ElementRef<HTMLElement> });
  private stages = viewChildren('stage', { read: ElementRef<HTMLElement> });
  private sections = viewChildren('section', { read: ElementRef<HTMLElement> });
  private frames = viewChildren('frame', { read: ElementRef<HTMLElement> });
  private gutters = viewChildren('gutter', { read: ElementRef<HTMLElement> });
  private notes = viewChildren('note', { read: ElementRef<HTMLElement> });
  private labels = viewChildren('stateLabel', { read: ElementRef<HTMLElement> });
  private labelRows = viewChildren('labelRow', { read: ElementRef<HTMLElement> });
  private listSize = signalElementDimensions(this.list);
  private gutterSize = signalElementDimensions(this.gutters);

  protected readonly LABELS = STUDIO_LABELS.sketches;
  protected readonly CURRENT = SKETCH_CURRENT;
  protected readonly COLUMN_GAP = COLUMN_GAP;
  protected readonly FRAME_KEY_OF = frameKeyOf;

  public zoom = linkedSignal<Zoom>(() => this.restoredCamera()?.zoom ?? zoomOf(this.camera()));
  protected reasonOpen = linkedSignal(() => this.reason());
  protected selectedFrame = signal<string | null>(null);
  private fitOverride = signal<number | null>(null);
  private pan = linkedSignal(() => {
    const restored = this.restoredCamera();
    const camera = this.camera();

    if (restored) return { x: restored.x, y: restored.y };

    return typeof camera === 'object' ? { x: Math.min(0, camera.x), y: Math.min(0, camera.y) } : { x: 0, y: 0 };
  });
  private userCamera$ = new Subject<Camera | null>();
  protected shownRows = computed(() =>
    this.fresh() ? this.rows().filter((row) => row.key !== SKETCH_CURRENT) : this.rows(),
  );

  public columns = computed(() => {
    const rows = this.shownRows();
    const widest = Math.max(1, ...rows.map((row) => row.width));
    const most = Math.max(1, ...rows.map((row) => row.shots.length));

    return Math.max(1, Math.min(MAX_COLUMNS, most, Math.floor(WRAP_WIDTH / widest)));
  });
  private widest = computed(() => Math.max(1, ...this.shownRows().map((row) => row.width)));
  private listWidth = computed(() => this.listSize().client?.width ?? 0);
  public transposed = computed(() => this.listWidth() > 0 && this.widest() > this.listWidth() / TRANSPOSE_SHARE);
  protected matrixStates = computed(() => [
    ...new Set(this.shownRows().flatMap((row) => row.shots.map((shot) => shot.state))),
  ]);
  private fitScale = computed(() => {
    const widest = this.widest();

    if (this.transposed()) {
      const count = this.shownRows().length;

      const gutter = this.gutterSize().offset?.width ?? 0;

      return Math.min(1, (this.listWidth() - gutter - count * COLUMN_GAP) / (count * widest));
    }

    return this.fitOverride() ?? 1;
  });
  protected scale = computed(() => {
    const zoom = this.zoom();

    return zoom === 'fit' ? this.fitScale() : zoom;
  });
  protected matrixColumns = computed(
    () => `max-content repeat(${this.shownRows().length}, ${this.widest() * this.scale()}px)`,
  );
  protected noteSize = computed(() => Math.max(MIN_TEXT, NOTE_TEXT * this.scale()));
  protected headColumns = computed(() => `${(HEAD_WIDTH * this.noteSize()) / NOTE_TEXT}px minmax(0, 1fr)`);
  protected labelFont = computed(() => LABEL_TEXT * this.scale());
  protected labelSize = computed(() => {
    const size = LABEL_TEXT * this.scale();

    return size < MIN_LABEL ? null : size;
  });
  protected drawnKey = computed(() => (this.status() === 'drawing' ? this.drawn() : null));
  protected percent = computed(() => {
    return Math.round(this.shownZoom() * 100);
  });
  protected worldTransform = computed(() => {
    const { x, y } = this.pan();

    return `translate(${x}px, ${y}px) scale(1)`;
  });

  constructor() {
    afterNextRender(() => {
      const teardown = mountFrameZoomViewport({
        viewport: this.list().nativeElement,
        frameSelector: '[data-sk-frame]',
        camera: () => ({ ...this.pan(), zoom: this.shownZoom() }),
        move: (camera) => this.move(camera),
        show: (target, frame) => this.show(target, frame),
        select: (frame) => this.selectedFrame.set(frame.dataset['skFrame'] ?? null),
        afterRender: (write) => afterNextRender({ write }, { injector: this.injector }),
      });

      this.destroyRef.onDestroy(teardown);
    });

    afterRenderEffect(() => {
      if (this.zoom() !== 'fit' || this.transposed()) return;

      this.listSize();
      this.shownRows();
      const elementsOf = (refs: readonly ElementRef<HTMLElement>[]) => refs.map(({ nativeElement }) => nativeElement);

      this.fitOverride.set(
        this.fitGrid({
          columns: this.columns(),
          list: this.list().nativeElement,
          sections: elementsOf(this.sections()),
          stages: elementsOf(this.stages()),
          frames: elementsOf(this.frames()),
          notes: elementsOf(this.notes()),
          labels: elementsOf(this.labels()),
          labelRows: elementsOf(this.labelRows()),
        }),
      );
    });

    this.userCamera$
      .pipe(
        debounceTime(300),
        tap((camera) => this.cameraChange.emit(camera)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected gridOf(row: SketchRow) {
    return `repeat(${this.columns()}, ${row.width * this.scale()}px)`;
  }

  protected matrixLineOf(state: string) {
    return `${2 + this.matrixStates().indexOf(state) * 2} / span 2`;
  }

  protected firstChangeOf(row: SketchRow) {
    return row.key === SKETCH_CURRENT ? null : (row.shots.find((shot) => shot.changed === true)?.state ?? null);
  }

  protected pinOf(key: string) {
    return this.pins().find((pin) => pin.variant === key);
  }

  protected selectRound(value: unknown) {
    if (typeof value === 'string') this.roundChange.emit(value);
  }

  protected toggleReason() {
    this.reasonOpen.update((open) => !open);
  }

  protected fit() {
    this.zoom.set('fit');
    this.pan.set({ x: 0, y: 0 });
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

  private fitGrid(dom: FitDom) {
    let scale = 1;

    for (let pass = 0; pass < FIT_PASSES; pass++) {
      this.applyGridScale(scale, dom);

      const next = this.gridFit(scale, dom);

      if (Math.abs(next - scale) <= FIT_SETTLED) break;

      scale = next;
    }

    return scale;
  }

  private applyGridScale(scale: number, { columns, sections, stages, frames, notes, labels, labelRows }: FitDom) {
    const note = Math.max(MIN_TEXT, NOTE_TEXT * scale);
    const { setStyle } = this.renderer;

    for (const section of sections) {
      setStyle(section, { gridTemplateColumns: `${(HEAD_WIDTH * note) / NOTE_TEXT}px minmax(0, 1fr)` });
    }
    for (const element of notes) setStyle(element, { fontSize: `${note}px` });
    for (const element of labels) setStyle(element, { fontSize: `${LABEL_TEXT * scale}px` });
    for (const row of labelRows) this.renderer.toggleClass(row, 'hidden', LABEL_TEXT * scale < MIN_LABEL);
    for (const stage of stages) {
      const inner = frames.find((frame) => stage.contains(frame))?.firstElementChild;

      if (inner instanceof HTMLElement) {
        setStyle(stage, { gridTemplateColumns: `repeat(${columns}, ${inner.offsetWidth * scale}px)` });
      }
    }
    for (const frame of frames) {
      const inner = frame.firstElementChild;

      if (inner instanceof HTMLElement) {
        setStyle(frame, { width: `${inner.offsetWidth * scale}px`, height: `${inner.offsetHeight * scale}px` });
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
    const zoom = this.zoom();
    const row = this.shownRows().find((candidate) => candidate.key !== this.drawnKey() && candidate.shots.length > 0);

    return zoom === 'fit' ? (row ? this.scale() : 1) : zoom;
  }

  private zoomTo(zoom: number) {
    this.move({ ...this.pan(), zoom });
  }

  private move(camera: Camera) {
    const zoom = clampZoom(camera.zoom);

    if (zoom !== this.shownZoom()) this.zoom.set(zoom);
    this.pan.set({ x: camera.x, y: camera.y });
    this.userCamera$.next({ x: camera.x, y: camera.y, zoom });
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
          const { x, y } = this.pan();

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
