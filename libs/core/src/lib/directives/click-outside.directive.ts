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

  constructor() {
    fromEvent<MouseEvent>(this.document.documentElement, 'click')
      .pipe(
        tap((event) => {
          const hostElement = this.elementRef.nativeElement;
          const activeElement = event.target as HTMLElement;
          const isInside = hostElement.contains(activeElement);

          if (isInside) return;

          if (isOnHigherOverlayLayer(activeElement, resolveOverlayLayer(hostElement))) return;

          this.didClickOutside.emit(event);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
