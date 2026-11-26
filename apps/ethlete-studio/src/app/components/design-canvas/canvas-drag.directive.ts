import { Directive, ElementRef, inject, input, output } from '@angular/core';

export type CanvasPoint = { x: number; y: number };

/** Drags its host on the canvas world from `ethleteCanvasDrag`, its point in world pixels: emits each moved point and, on release after a move, the last one. */
@Directive({
  selector: '[ethleteCanvasDrag]',
  host: {
    '(pointerdown)': 'start($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'end($event)',
    '(pointercancel)': 'end($event)',
  },
})
export class CanvasDragDirective {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  public ethleteCanvasDrag = input.required<CanvasPoint>();
  public canvasDragZoom = input(1);

  public canvasDragMove = output<CanvasPoint>();
  public canvasDragEnd = output<CanvasPoint>();

  private drag: (CanvasPoint & { moved: boolean }) | null = null;

  protected start(event: PointerEvent) {
    if (event.button !== 0) return;

    event.stopPropagation();
    this.host.nativeElement.setPointerCapture(event.pointerId);
    this.drag = { ...this.ethleteCanvasDrag(), moved: false };
  }

  protected move(event: PointerEvent) {
    const drag = this.drag;

    if (!drag || !this.host.nativeElement.hasPointerCapture(event.pointerId)) return;

    drag.x += event.movementX / this.canvasDragZoom();
    drag.y += event.movementY / this.canvasDragZoom();
    drag.moved = true;
    this.canvasDragMove.emit({ x: Math.round(drag.x), y: Math.round(drag.y) });
  }

  protected end(event: PointerEvent) {
    const drag = this.drag;
    const element = this.host.nativeElement;

    this.drag = null;
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    if (drag?.moved) this.canvasDragEnd.emit({ x: Math.round(drag.x), y: Math.round(drag.y) });
  }
}
