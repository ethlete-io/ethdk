import { Directive, ElementRef, inject, input, output } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, switchMap, tap } from 'rxjs';
import { paintedFrame$ } from '../frame-paint';

/** Emits whether the page of this iframe painted; `false` again for each new `ethleteFramePainted` address. */
@Directive({ selector: 'iframe[ethleteFramePainted]' })
export class FramePaintedDirective {
  private iframe = inject<ElementRef<HTMLIFrameElement>>(ElementRef);

  public ethleteFramePainted = input.required<unknown>();
  public paintedChange = output<boolean>();

  constructor() {
    toObservable(this.ethleteFramePainted)
      .pipe(
        switchMap(() => paintedFrame$(this.iframe.nativeElement)),
        distinctUntilChanged(),
        tap((painted) => this.paintedChange.emit(painted)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
