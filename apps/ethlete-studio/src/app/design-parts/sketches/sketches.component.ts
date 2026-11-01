import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  input,
  model,
  output,
  signal,
  TemplateRef,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';
import { injectRenderer, injectSemanticColorTheme } from '@ethlete/core';
import { Camera, CanvasViewport, mountCanvasViewport, Rect } from '../../components/design-canvas/canvas-viewport';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { AgentLogoComponent } from '../../icons/agent-logo.component';
import { CanvasViewportComponent } from '../canvas-viewport/canvas-viewport.component';
import { CommentPinComponent } from '../comment-pin/comment-pin.component';
import { PartTreeComponent } from '../part-tree/part-tree.component';
import { ShellMainComponent, ShellSection } from '../shell-main/shell-main.component';
import { StudioMenuComponent } from '../studio-menu/studio-menu.component';
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
    CanvasViewportComponent,
    CommentPinComponent,
    PartTreeComponent,
    ShellMainComponent,
    StudioMenuComponent,
    ZoomChipComponent,
  ],
  host: { class: 'block h-screen w-full' },
})
export class SketchesComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  private renderer = injectRenderer();
  public camera = input<'fit' | Camera>('fit');
  public selected = input<string | undefined>(undefined);
  public part = input('pages/system');
  public variants = input<SketchVariant[]>(SKETCH_VARIANTS);
  public rounds = input(SKETCH_ROUNDS);
  public round = input(SKETCH_ROUNDS[0]?.value ?? '');
  public pins = input<SketchPin[]>(SKETCH_PINS);
  public shot = input<TemplateRef<{ $implicit: SketchVariant }> | null>(null);
  public tree = input(SKETCH_TREE);
  public product = input('studio');
  public products = input(['studio', 'timetrack', 'docs']);
  public project = input('ethlete-sdk');
  public projects = input(['ethlete-sdk', 'fut-frontend', 'design-playground']);

  public panel = input<'open' | 'hidden'>('open');
  public menuOpen = model(false);
  public discard = output();
  public merge = output<string>();
  public roundChange = output<string>();
  public pinToggle = output<string>();
  public pick = output<string>();
  public collapse = output();
  public sectionChange = output<ShellSection>();
  public productChange = output<string>();
  public allProducts = output();

  public projectChange = output<string>();
  public openProject = output();
  private page = viewChild.required<ElementRef<HTMLElement>>('page');

  private viewport = viewChild.required(CanvasViewportComponent, { read: ElementRef });
  private world = viewChild.required<ElementRef<HTMLElement>>('world');
  private frames = viewChildren<ElementRef<HTMLElement>>('frame');
  protected readonly LABELS = STUDIO_LABELS.sketches;
  protected readonly CURRENT = SKETCH_CURRENT;

  protected heads = signal<HeadPlace[]>([]);
  public zoom = signal(1);
  protected percent = computed(() => Math.round(this.zoom() * 100));
  private canvas: CanvasViewport | null = null;

  constructor() {
    afterNextRender(() => this.mountCamera());
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
    this.canvas?.show({ kind: 'visible', zoom: this.canvas.camera().zoom * factor });
  }

  protected zoomOut() {
    this.zoomBy(1 / ZOOM_STEP);
  }

  protected zoomIn() {
    this.zoomBy(ZOOM_STEP);
  }

  protected zoomReset() {
    this.canvas?.show({ kind: 'visible', zoom: 1 });
  }

  protected fit() {
    this.canvas?.show({ kind: 'all' });
  }

  private mountCamera() {
    const viewport: HTMLElement = this.viewport().nativeElement;
    const world = this.world().nativeElement;
    const camera = this.camera();

    if (camera !== 'fit') {
      const frames = this.frames().map(({ nativeElement: element }) => ({
        x: element.offsetLeft,
        y: element.offsetTop,
        width: element.offsetWidth,
        height: element.offsetHeight,
      }));

      this.renderer.setStyle(world, { transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` });
      this.paint(camera, frames);

      return;
    }

    this.canvas = mountCanvasViewport({
      viewport,
      world,
      frameSelector: '[data-sk-frame]',
      padding: HEAD_INSET,
      outline: 1,
      onPaint: (next, frames) => this.paint(next, frames),
    });
  }

  private paint(camera: Camera, frames: Rect[]) {
    const page = this.page().nativeElement;
    const viewport: HTMLElement = this.viewport().nativeElement;
    const bound = viewport.offsetLeft + HEAD_INSET;

    this.zoom.set(camera.zoom);
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
