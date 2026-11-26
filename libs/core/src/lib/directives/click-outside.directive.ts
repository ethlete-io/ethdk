import { Directive, DOCUMENT, ElementRef, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, tap } from 'rxjs';
import { isOnHigherOverlayLayer, resolveOverlayLayer } from '../overlay/overlay-layer';

@Directive({
  selector: '[etClickOutside]',
})
export class ClickOutsideDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private document = inject(DOCUMENT);

  didClickOutside = output<MouseEvent>({ alias: 'etClickOutside' });

  private pressStartedInside = false;

  constructor() {
    fromEvent<PointerEvent>(this.document.documentElement, 'pointerdown', { capture: true })
      .pipe(
        tap((event) => {
          this.pressStartedInside = event.composedPath().includes(this.elementRef.nativeElement);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    fromEvent<PointerEvent>(this.document.documentElement, 'pointercancel', { capture: true })
      .pipe(
        tap(() => (this.pressStartedInside = false)),
        takeUntilDestroyed(),
      )
      .subscribe();

    fromEvent<MouseEvent>(this.document.documentElement, 'click')
      .pipe(
        tap((event) => {
          const hostElement = this.elementRef.nativeElement;
          const activeElement = event.target as HTMLElement;
          const startedInside = this.pressStartedInside;

          this.pressStartedInside = false;

          if (startedInside || event.composedPath().includes(hostElement)) return;

          if (isOnHigherOverlayLayer(activeElement, resolveOverlayLayer(hostElement))) return;

          this.didClickOutside.emit(event);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
