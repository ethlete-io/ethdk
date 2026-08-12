import { Component, DestroyRef, ViewEncapsulation, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  BUTTON_IMPORTS,
  ICON_IMPORTS,
  MINUS_ICON,
  TIMES_ICON,
  WINDOW_CONTROL_BUTTON_KINDS,
  provideIcons,
} from '@ethlete/components';
import { EMPTY, Observable, catchError, fromEvent, of, startWith, switchMap } from 'rxjs';
import { injectHostPorts } from '../host';
import { MAXIMIZE_ICON, RESTORE_ICON } from './window-control-icons';

@Component({
  selector: 'ethlete-window-controls',
  template: `
    @if (capabilities(); as capabilities) {
      <div class="flex items-center gap-1">
        @if (capabilities.minimize) {
          <button (click)="minimize()" et-window-control-button size="sm" aria-label="Minimise">
            <i etIcon="et-minus"></i>
          </button>
        }

        @if (capabilities.maximize) {
          <button
            [attr.aria-label]="isMaximized() ? 'Restore' : 'Maximise'"
            (click)="toggleMaximize()"
            et-window-control-button
            size="sm"
          >
            <i [etIcon]="isMaximized() ? 'timetrack-restore' : 'timetrack-maximize'"></i>
          </button>
        }

        <button [kind]="CLOSE_KIND" (click)="close()" et-window-control-button size="sm" aria-label="Close">
          <i etIcon="et-times"></i>
        </button>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ICON_IMPORTS],
  providers: [provideIcons(MINUS_ICON, TIMES_ICON, MAXIMIZE_ICON, RESTORE_ICON)],
})
export class WindowControlsComponent {
  private destroyRef = inject(DestroyRef);
  private controls = injectHostPorts().windowControls;

  protected readonly CLOSE_KIND = WINDOW_CONTROL_BUTTON_KINDS.CLOSE;

  /**
   * `null` until the host answers, and for good outside the desktop shell — a browser has no window
   * to control, so the whole cluster stays off rather than offering buttons that would throw.
   */
  protected capabilities = toSignal(this.controls.capabilities$().pipe(catchError(() => of(null))), {
    initialValue: null,
  });

  /** Maximising is what resizes the webview, so the DOM's own resize event is the state change. */
  protected isMaximized = toSignal(
    fromEvent(globalThis, 'resize').pipe(
      startWith(null),
      switchMap(() => this.controls.isMaximized$().pipe(catchError(() => EMPTY))),
    ),
    { initialValue: false },
  );

  protected minimize() {
    this.run(this.controls.minimize$());
  }

  protected toggleMaximize() {
    this.run(this.controls.toggleMaximize$());
  }

  protected close() {
    this.run(this.controls.close$());
  }

  private run(action$: Observable<void>) {
    action$
      .pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
