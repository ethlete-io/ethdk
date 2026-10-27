import {
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ResizeHandlesComponent, ResizeMoveEvent, dragGestureFrom, signalElementDimensions } from '@ethlete/core';
import { Subject, debounceTime, exhaustMap, skip, tap } from 'rxjs';
import { CanvasFrame } from './canvas-frame';
import {
  Camera,
  Point,
  Rect,
  Size,
  boundingRect,
  fitRect,
  layoutSheet,
  panCamera,
  rectsIntersect,
  visibleWorldRect,
  wheelZoomFactor,
  zoomAtPoint,
} from './canvas-math';
import { CanvasFrameComponent } from './partials/canvas-frame.component';

const SPACING = { columnGap: 40, rowGap: 120 };
const FALLBACK_HEIGHT = 600;
const MIN_FRAME_WIDTH = 160;
const FIT_PADDING = 64;
const LIVE_MARGIN = 400;
const LIVE_MIN_ZOOM = 0.5;
const ZOOM_STEP = 1.5;

type PlacedFrame = Rect & { frame: CanvasFrame; live: boolean; active: boolean; selected: boolean };

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

@Component({
  selector: 'ethlete-design-canvas',
  templateUrl: './design-canvas.component.html',
  styleUrl: './design-canvas.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [CanvasFrameComponent, ResizeHandlesComponent],
  host: {
    class: 'et-design-canvas',
    '[class.et-design-canvas--space]': 'spaceHeld()',
    '[class.et-design-canvas--panning]': 'panning()',
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

  /** Names what the canvas shows. A new key fits the camera again, or restores `restoredCamera`. */
  public cameraKey = input<string | null>(null);

  /** The camera to show instead of a fit, read when `cameraKey` changes. */
  public restoredCamera = input<Camera | null>(null);

  public camera = signal<Camera>({ x: 0, y: 0, zoom: 1 });

  /** The camera after it came to rest, once it was fitted or restored. */
  public cameraChange = outputFromObservable(toObservable(this.camera).pipe(skip(1), debounceTime(300)));
  protected smooth = signal(false);
  public selectedId = signal<string | null>(null);
  public activeId = signal<string | null>(null);
  protected spaceHeld = signal(false);
  protected panning = signal(false);
  private widths = signal<Record<string, number>>({});
  private measuredHeights = signal<Record<string, number>>({});

  private dimensions = signalElementDimensions(this.host);
  private viewport = computed<Size>(() => this.dimensions().client ?? { width: 0, height: 0 });

  private layout = computed(() => {
    const widths = this.widths();
    const heights = this.measuredHeights();
    const frames = this.frames();
    const byId = new Map(frames.map((frame) => [frame.id, frame]));
    const sheet = layoutSheet(
      frames.map((frame) => ({
        id: frame.id,
        row: frame.row ?? '',
        width: widths[frame.id] ?? frame.width,
        height: frame.height ?? heights[frame.id] ?? FALLBACK_HEIGHT,
      })),
      SPACING,
    );

    return {
      rows: sheet.rows.filter((row) => row.name !== ''),
      frames: sheet.frames.flatMap((placed) => {
        const frame = byId.get(placed.id);

        return frame ? [{ ...placed, frame }] : [];
      }),
    };
  });

  protected rows = computed(() => this.layout().rows);

  protected placedFrames = computed<PlacedFrame[]>(() => {
    const camera = this.camera();
    const visible =
      camera.zoom >= LIVE_MIN_ZOOM
        ? visibleWorldRect({ camera, viewport: this.viewport(), margin: LIVE_MARGIN })
        : null;
    const activeId = this.activeId();
    const selectedId = this.selectedId();

    return this.layout().frames.map(({ x, y, width, height, frame }) => ({
      x,
      y,
      width,
      height,
      frame,
      active: frame.id === activeId,
      selected: frame.id === selectedId,
      live: frame.id === activeId || (!!visible && rectsIntersect({ x, y, width, height }, visible)),
    }));
  });

  protected activeFrame = computed(() => this.placedFrames().find((placed) => placed.active) ?? null);

  protected worldTransform = computed(() => {
    const { x, y, zoom } = this.camera();

    return `translate(${x}px, ${y}px) scale(${zoom})`;
  });

  protected labelScale = computed(() => 1 / Math.max(this.camera().zoom, 0.25));

  protected zoomPercent = computed(() => Math.round(this.camera().zoom * 100));

  private panStart$ = new Subject<PointerEvent>();
  private resizeStartWidth = 0;
  private swallowNextClick = false;

  private fittedFor: string | null | undefined = undefined;

  protected readonly ZOOM_STEP = ZOOM_STEP;

  constructor() {
    effect(() => {
      const bounds = boundingRect(this.layout().frames);
      const viewport = this.viewport();
      const key = this.cameraKey();

      if (!bounds || viewport.width === 0 || viewport.height === 0) return;

      untracked(() => {
        if (this.fittedFor === key) return;
        this.fittedFor = key;
        this.camera.set(this.restoredCamera() ?? fitRect({ rect: bounds, viewport, padding: FIT_PADDING }));
      });
    });

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

  protected activate(id: string) {
    this.selectedId.set(id);
    this.activeId.set(id);
  }

  protected leaveActiveFrame() {
    this.activeId.set(null);
  }

  protected clearSelection(event: MouseEvent) {
    if (this.consumeSwallowedClick()) return;
    if (event.target !== this.host.nativeElement) return;
    this.selectedId.set(null);
    this.activeId.set(null);
  }

  protected storeHeight(id: string, height: number) {
    this.measuredHeights.update((heights) => (heights[id] === height ? heights : { ...heights, [id]: height }));
  }

  protected startResize(width: number) {
    this.resizeStartWidth = width;
  }

  protected resize(id: string, event: ResizeMoveEvent) {
    const width = Math.max(MIN_FRAME_WIDTH, Math.round(this.resizeStartWidth + event.totalDx / this.camera().zoom));

    this.widths.update((widths) => ({ ...widths, [id]: width }));
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
      if (this.activeId()) this.leaveActiveFrame();
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

  protected fitAll() {
    const bounds = boundingRect(this.layout().frames);

    if (bounds) this.moveCamera(fitRect({ rect: bounds, viewport: this.viewport(), padding: FIT_PADDING }), true);
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

  private moveCamera(camera: Camera, smooth = false) {
    this.smooth.set(smooth);
    this.camera.set(camera);
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
