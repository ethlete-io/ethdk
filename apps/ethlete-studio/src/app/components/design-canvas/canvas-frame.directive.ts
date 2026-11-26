import {
  afterRenderEffect,
  createComponent,
  DestroyRef,
  Directive,
  ElementRef,
  EnvironmentInjector,
  inject,
  Renderer2,
  signal,
} from '@angular/core';
import { CanvasFrameBorderComponent } from './partials/canvas-frame-border.component';

/** Marks an element projected into `ethlete-design-canvas` as a frame the camera fits, focuses and selects. */
@Directive({
  selector: '[ethleteCanvasFrame]',
  host: {
    class: 'group/frame',
    'data-canvas-frame': '',
    '[attr.data-selected]': 'selected() || null',
  },
})
export class CanvasFrameDirective {
  private renderer = inject(Renderer2);

  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private border = createComponent(CanvasFrameBorderComponent, { environmentInjector: inject(EnvironmentInjector) });
  public selected = signal(false);

  constructor() {
    const border = this.border.location.nativeElement;

    this.renderer.addClass(border, 'inset-0');
    this.border.changeDetectorRef.detectChanges();
    inject(DestroyRef).onDestroy(() => this.border.destroy());

    afterRenderEffect(() => {
      if (this.selected()) {
        this.renderer.appendChild(this.elementRef.nativeElement, border);
      } else {
        this.renderer.removeChild(this.elementRef.nativeElement, border);
      }
    });
  }
}
