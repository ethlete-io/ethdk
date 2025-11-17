import { Directive, DOCUMENT, ElementRef, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, tap } from 'rxjs';

@Directive({
  selector: '[etClickOutside]',
})
export class ClickOutsideDirective {
  private elementRef = inject(ElementRef);
  private document = inject(DOCUMENT);

  didClickOutside = output<MouseEvent>({ alias: 'etClickOutside' });

  constructor() {
    fromEvent<MouseEvent>(this.document.documentElement, 'click')
      .pipe(
        tap((event) => {
          const activeElement = event.target as HTMLElement;
          const isInside = this.elementRef.nativeElement.contains(activeElement);

          if (isInside) return;

          this.didClickOutside.emit(event);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
