import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, computed, contentChild, inject, signal, viewChild } from '@angular/core';
import { ResizeEdge, ResizeHandlesComponent } from '@ethlete/core';
import { PipCollapseOverlayDirective } from './headless/pip-collapse-overlay.directive';
import { PipTitleBarTemplateDirective } from './headless/pip-title-bar-template.directive';
import { PipTitleBarDirective } from './headless/pip-title-bar.directive';
import { PipWindowParamsDirective } from './headless/pip-window-params.directive';
import { createPipWindowPosition } from './headless/internals/pip-window-position';
import { createPipWindowSize } from './headless/internals/pip-window-size';
import { injectStreamLabels } from '../stream-labels';

const KEYBOARD_STEP_PX = 10;

const KEYBOARD_ARROW_DELTAS: Record<string, { dx: number; dy: number } | undefined> = {
  ArrowLeft: { dx: -KEYBOARD_STEP_PX, dy: 0 },
  ArrowRight: { dx: KEYBOARD_STEP_PX, dy: 0 },
  ArrowUp: { dx: 0, dy: -KEYBOARD_STEP_PX },
  ArrowDown: { dx: 0, dy: KEYBOARD_STEP_PX },
};

@Component({
  selector: 'et-pip-window',
  templateUrl: './pip-window.component.html',
  styleUrl: './pip-window.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, ResizeHandlesComponent, PipTitleBarDirective, PipCollapseOverlayDirective],
  hostDirectives: [PipWindowParamsDirective],
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
  protected labels = injectStreamLabels();

  private resizeHandles = viewChild.required(ResizeHandlesComponent);
  private titleBar = viewChild.required(PipTitleBarDirective);
  protected titleBarTemplate = contentChild.required(PipTitleBarTemplateDirective);

  protected dragHandle = computed(() => this.titleBar().dragHandle);
  protected titleBarH = computed(() => this.titleBar().titleBarH());

  public sizeState = createPipWindowSize({
    params: this.params,
    titleBarH: this.titleBarH,
  });

  public forcedTitleBar = signal(false);

  public posState = createPipWindowPosition({
    params: this.params,
    titleBarH: this.titleBarH,
    size: this.sizeState,
    resizeHandles: this.resizeHandles,
    dragHandle: this.dragHandle,
    forcedTitleBar: this.forcedTitleBar,
  });

  public readonly RESIZE_EDGES: ResizeEdge[] = ['s', 'e', 'w', 'se', 'sw'];

  protected handleTitleBarKeydown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const delta = KEYBOARD_ARROW_DELTAS[event.key];

    if (delta) {
      event.preventDefault();

      if (event.shiftKey) {
        this.posState.resizeBy({ dw: delta.dx, dh: delta.dy });
      } else {
        this.posState.nudge(delta);
      }
    } else if (!event.shiftKey && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      this.posState.expand();
    }
  }
}
