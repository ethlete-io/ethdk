import { Directive, ElementRef, InjectionToken, inject } from '@angular/core';

export const ROOT_BOUNDARY_TOKEN = new InjectionToken<RootBoundaryDirective>('ROOT_BOUNDARY_TOKEN');

@Directive({
  selector: '[etRootBoundary]',
  standalone: true,
  providers: [
    {
      provide: ROOT_BOUNDARY_TOKEN,
      useExisting: RootBoundaryDirective,
    },
  ],
})
export class RootBoundaryDirective {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  get boundaryElement() {
    return this._boundaryElement ?? this._elementRef.nativeElement;
  }
  set boundaryElement(v: HTMLElement | null) {
    this._boundaryElement = v;
  }
  private _boundaryElement: HTMLElement | null = null;
}
