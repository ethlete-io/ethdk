import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ResizeEdge, ResizeHandlesComponent } from '@ethlete/core';
import { PipCollapseOverlayDirective } from './pip-collapse-overlay.directive';
import { PipTitleBarDirective } from './pip-title-bar.directive';
import { createPipWindowPosition } from './pip-window-position';
import { createPipWindowSize } from './pip-window-size';

@Component({
  selector: 'et-pip-window',
  imports: [ResizeHandlesComponent, PipTitleBarDirective, PipCollapseOverlayDirective],
  templateUrl: './pip-window.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './pip-window.component.css',
  host: {
    class: 'et-pip-window',
    '[class.et-pip-window--title-bar-forced]': 'forcedTitleBar()',
    '[class.et-pip-window--dragging]': 'posState.isDragging()',
    '[class.et-pip-window--collapsed]': 'posState.isCollapsed()',
    '[class.et-pip-window--resizing]': 'posState.isResizing()',
    '[class.et-pip-window--positioned]': 'posState.positionInitialized()',
    '[style.translate]': 'posState.position()',
    '[style.width.px]': 'sizeState.w()',
    '[style.height.px]': 'sizeState.h()',
    '[style.--et-pip-title-bar-h.px]': 'titleBarH()',
  },
})
export class PipWindowComponent {
  private resizeHandles = viewChild.required(ResizeHandlesComponent);
  private titleBar = viewChild.required(PipTitleBarDirective);

  minWidth = input(160);
  maxWidth = input(640);
  minHeight = input(90);
  maxHeight = input(360);
  aspectRatio = input<number | null>(null);
  collapsePeek = input(40);
  viewportPadding = input(8);

  protected dragHandle = computed(() => this.titleBar().dragHandle);
  protected titleBarH = computed(() => this.titleBar().titleBarH());

  sizeState = createPipWindowSize({
    aspectRatio: this.aspectRatio,
    viewportPadding: this.viewportPadding,
    minWidth: this.minWidth,
    minHeight: this.minHeight,
    titleBarH: this.titleBarH,
  });

  forcedTitleBar = signal(false);

  posState = createPipWindowPosition({
    collapsePeek: this.collapsePeek,
    viewportPadding: this.viewportPadding,
    aspectRatio: this.aspectRatio,
    minWidth: this.minWidth,
    maxWidth: this.maxWidth,
    titleBarH: this.titleBarH,
    size: this.sizeState,
    resizeHandles: this.resizeHandles,
    dragHandle: this.dragHandle,
    forcedTitleBar: this.forcedTitleBar,
  });

  readonly RESIZE_EDGES: ResizeEdge[] = ['s', 'e', 'w', 'se', 'sw'];
}
