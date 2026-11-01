import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';
import { injectSemanticColorTheme, signalElementDimensions } from '@ethlete/core';
import { Camera, Rect } from '../../components/design-canvas/canvas-math';
import { CanvasFrameDirective } from '../../components/design-canvas/canvas-frame.directive';
import { DesignCanvasComponent } from '../../components/design-canvas/design-canvas.component';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { AgentLogoComponent } from '../../icons/agent-logo.component';
import { CommentPinComponent } from '../comment-pin/comment-pin.component';
import { PartTreeComponent } from '../part-tree/part-tree.component';
import { SHELL_SAMPLE, ShellAction, ShellPageComponent, ShellState } from '../shell-main/shell-page.component';
import { ZoomChipComponent } from '../zoom-chip/zoom-chip.component';
import {
  SKETCH_CURRENT,
  SKETCH_PINS,
  SKETCH_ROUNDS,
  SKETCH_TREE,
  SKETCH_VARIANTS,
  SketchPin,
  SketchVariant,
} from './sketches-sample';

type HeadPlace = { left: number; top: number; width: number; hidden: boolean };

const HEAD_INSET = 3;
const HEAD_MIN_WIDTH = 180;
const HEAD_GAP = 18;
const ZOOM_STEP = 1.5;

const FRAME = 'relative m-0 box-border flex rounded-control-md bg-et-surface-bg p-space-2';

@Component({
  selector: 'ethlete-sketches',
  templateUrl: './sketches.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    FORM_FIELD_IMPORTS,
    SELECT_IMPORTS,
    NgTemplateOutlet,
    AgentLogoComponent,
    CanvasFrameDirective,
    DesignCanvasComponent,
    CommentPinComponent,
    PartTreeComponent,
    ShellPageComponent,
    ZoomChipComponent,
  ],
  host: { class: 'block h-screen w-full' },
})
export class SketchesComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  public shell = input<ShellState>(SHELL_SAMPLE);
  public camera = input<'fit' | Camera>('fit');
  public selected = input<string | undefined>(undefined);
  public part = input('pages/system');
  public variants = input<SketchVariant[]>(SKETCH_VARIANTS);
  public rounds = input(SKETCH_ROUNDS);
  public round = input(SKETCH_ROUNDS[0]?.value ?? '');
  public pins = input<SketchPin[]>(SKETCH_PINS);
  public shot = input<TemplateRef<{ $implicit: SketchVariant }> | null>(null);
  public tree = input(SKETCH_TREE);
  public shellAction = output<ShellAction>();

  public discard = output();
  public merge = output<string>();
  public roundChange = output<string>();
  public pinToggle = output<string>();
  public pick = output<string>();
  public expandedChange = output<readonly string[]>();

  private page = viewChild.required<ElementRef<HTMLElement>>('page');

  private viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private canvas = viewChild.required(DesignCanvasComponent);
  private viewportSize = signalElementDimensions(this.viewport);
  protected readonly HEAD_INSET = HEAD_INSET;
  protected readonly LABELS = STUDIO_LABELS.sketches;
  protected readonly CURRENT = SKETCH_CURRENT;

  protected heads = signal<HeadPlace[]>([]);
  public zoom = computed(() => this.canvas().camera().zoom);
  protected percent = computed(() => Math.round(this.zoom() * 100));
  protected fixedCamera = computed(() => {
    const camera = this.camera();

    return camera === 'fit' ? null : camera;
  });

  constructor() {
    afterRenderEffect(() => {
      const canvas = this.canvas();

      this.viewportSize();
      this.paint(canvas.camera(), canvas.projectedRects());
    });
  }

  protected frameClass(key: string) {
    return key === this.selected()
      ? `${FRAME} shadow-[0_0_0_2px_var(--et-theme-color-primary-solid)]`
      : `${FRAME} shadow-[0_0_0_1px_var(--et-surface-border-solid)]`;
  }

  protected pinOf(key: string) {
    return this.pins().find((pin) => pin.variant === key);
  }

  protected selectRound(value: unknown) {
    if (typeof value === 'string') this.roundChange.emit(value);
  }

  public zoomBy(factor: number) {
    this.canvas().show({ kind: 'visible', zoom: this.zoom() * factor });
  }

  protected zoomOut() {
    this.zoomBy(1 / ZOOM_STEP);
  }

  protected zoomIn() {
    this.zoomBy(ZOOM_STEP);
  }

  protected zoomReset() {
    this.canvas().show({ kind: 'visible', zoom: 1 });
  }

  protected fit() {
    this.canvas().show({ kind: 'all' });
  }

  private paint(camera: Camera, frames: Rect[]) {
    const page = this.page().nativeElement;
    const viewport: HTMLElement = this.viewport().nativeElement;
    const bound = viewport.offsetLeft + HEAD_INSET;

    this.heads.set(
      frames.map((column) => {
        const start = viewport.offsetLeft + camera.x + column.x * camera.zoom;
        const left = Math.max(bound, start);
        const right = Math.min(page.clientWidth, start + column.width * camera.zoom);

        return {
          left,
          top: viewport.offsetTop + camera.y + column.y * camera.zoom - HEAD_GAP,
          width: Math.max(0, right - left),
          hidden: right - left < HEAD_MIN_WIDTH,
        };
      }),
    );
  }
}
