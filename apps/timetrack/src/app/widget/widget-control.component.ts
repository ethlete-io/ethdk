import { Component, ViewEncapsulation, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { EMPTY, Subject, catchError, exhaustMap, tap } from 'rxjs';
import { injectHostPorts } from '../../host';

/**
 * Shows and hides the floating readout, from the band the pause and the timer are already in.
 *
 * The host is asked whether one is open rather than a flag being kept here: the widget can also close
 * itself, and a button that has to be pressed twice after that is a button that lies.
 */
@Component({
  selector: 'ethlete-widget-control',
  template: `
    <button (click)="toggle()" et-button variant="transparent" size="sm">
      {{ isOpen() ? 'Hide readout' : 'Show readout' }}
    </button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class WidgetControlComponent {
  private ports = injectHostPorts();
  protected isOpen = signal(false);

  private toggles$ = new Subject<void>();

  constructor() {
    this.ports.widget
      .isOpen$()
      .pipe(
        tap((open) => this.isOpen.set(open)),
        catchError(() => EMPTY),
        takeUntilDestroyed(),
      )
      .subscribe();

    // `exhaustMap`, so a second press while the first is in flight is dropped rather than opening and
    // closing the window in the order the host happens to finish in.
    this.toggles$
      .pipe(
        exhaustMap(() => {
          const closing = this.isOpen();

          return (closing ? this.ports.widget.close$() : this.ports.widget.open$()).pipe(
            tap(() => this.isOpen.set(!closing)),
            catchError(() => EMPTY),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected toggle() {
    this.toggles$.next();
  }
}
