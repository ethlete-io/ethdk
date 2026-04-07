import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ResizeEdge, ResizeHandlesComponent } from '@ethlete/core';
import { PipCollapseOverlayDirective } from './pip-collapse-overlay.directive';
import { PipTitleBarDirective } from './pip-title-bar.directive';
import { PipWindowParamsDirective } from './pip-window-params.directive';
import { createPipWindowPosition } from './pip-window-position';
import { createPipWindowSize } from './pip-window-size';

@Component({
  selector: 'et-pip-window',
  imports: [ResizeHandlesComponent, PipTitleBarDirective, PipCollapseOverlayDirective],
  templateUrl: './pip-window.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './pip-window.component.css',
  hostDirectives: [
    {
      directive: PipWindowParamsDirective,
      inputs: ['aspectRatio', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'collapsePeek', 'viewportPadding'],
    },
  ],
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
    '[style.--et-pip-content-ratio]': '!posState.positionInitialized() ? params.aspectRatio() : null',
  },
})
export class PipWindowComponent {
  protected params = inject(PipWindowParamsDirective);

  private resizeHandles = viewChild.required(ResizeHandlesComponent);
  private titleBar = viewChild.required(PipTitleBarDirective);

  protected dragHandle = computed(() => this.titleBar().dragHandle);
  protected titleBarH = computed(() => this.titleBar().titleBarH());

  sizeState = createPipWindowSize({
    params: this.params,
    titleBarH: this.titleBarH,
  });

  forcedTitleBar = signal(false);

  posState = createPipWindowPosition({
    params: this.params,
    titleBarH: this.titleBarH,
    size: this.sizeState,
    resizeHandles: this.resizeHandles,
    dragHandle: this.dragHandle,
    forcedTitleBar: this.forcedTitleBar,
  });

  readonly RESIZE_EDGES: ResizeEdge[] = ['s', 'e', 'w', 'se', 'sw'];
}
