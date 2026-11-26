import { Component, DestroyRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BUTTON_IMPORTS,
  dialogOverlayStrategy,
  injectOverlayManager,
  OVERLAY_CONTENT_IMPORTS,
  OVERLAY_REF,
} from '@ethlete/components';
import { tap, timer } from 'rxjs';

@Component({
  selector: 'app-overlay-busy-state-content',
  template: `
    <div etOverlayMain>
      <div etOverlayHeader>
        <h2 et-overlay-title>Cancel subscription</h2>
      </div>

      <div et-overlay-body>
        <p>
          Submitting keeps this dialog open for two seconds. Escape, the backdrop and the Close button do nothing until
          it finishes.
        </p>
      </div>

      <div etOverlayFooter>
        <button et-button etOverlayClose size="sm" variant="outline">Close</button>
        <button [disabled]="overlayRef.busy()" (click)="submit()" et-button size="sm">
          {{ overlayRef.busy() ? 'Submitting…' : 'Submit' }}
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS],
})
export class OverlayBusyStateContentComponent {
  private destroyRef = inject(DestroyRef);
  protected overlayRef = inject(OVERLAY_REF);

  protected submit() {
    this.overlayRef.busy.set(true);

    timer(2000)
      .pipe(
        tap(() => {
          this.overlayRef.busy.set(false);
          this.overlayRef.close('submitted');
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}

@Component({
  selector: 'app-overlay-busy-state-example',
  template: `
    <button (click)="open()" et-button>Open dialog</button>
    @if (lastResult() !== undefined) {
      <p>Last close result: {{ lastResult() }}</p>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class OverlayBusyStateExampleComponent {
  private overlays = injectOverlayManager();

  protected lastResult = signal<string | undefined>(undefined);

  protected open() {
    this.overlays
      .open<OverlayBusyStateContentComponent, string>(OverlayBusyStateContentComponent, {
        strategies: dialogOverlayStrategy(),
      })
      .afterClosed()
      .pipe(tap((result) => this.lastResult.set(result ?? '(dismissed)')))
      .subscribe();
  }
}
