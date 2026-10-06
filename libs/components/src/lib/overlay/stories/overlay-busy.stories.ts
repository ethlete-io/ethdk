import { Component, DestroyRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { applicationConfig, Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { tap, timer } from 'rxjs';
import { BUTTON_IMPORTS } from '../../button';
import { injectOverlayManager } from '../overlay-manager';
import { OVERLAY_REF } from '../overlay-ref';
import { OVERLAY_CONTENT_IMPORTS, provideOverlay } from '../overlay.imports';
import { dialogOverlayStrategy } from '../strategies';

@Component({
  selector: 'et-sb-busy-overlay',
  template: `
    <div class="font-sans" etOverlayMain>
      <div etOverlayHeader>
        <h2 class="text-h6 font-title" et-overlay-title>Cancel subscription</h2>
      </div>

      <div et-overlay-body>
        <p class="max-w-sm text-medium text-white/70">
          Submitting keeps this dialog open for two seconds. Escape, the backdrop and the Close button do nothing until
          it finishes.
        </p>
      </div>

      <div class="flex justify-end gap-2" etOverlayFooter>
        <button et-button etOverlayClose size="sm" variant="outline">Close</button>
        <button [disabled]="overlayRef.busy()" (click)="submit()" class="et-sb-busy-submit" et-button size="sm">
          {{ overlayRef.busy() ? 'Submitting…' : 'Submit' }}
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS],
})
class BusyOverlayComponent {
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
  selector: 'et-sb-overlay-busy',
  template: `
    <div class="flex flex-col items-start gap-4 p-8 font-sans">
      <button (click)="open()" et-button>Open dialog</button>
      @if (lastResult() !== undefined) {
        <p class="text-small text-white/50">Last close result: {{ lastResult() }}</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  styles: `
    .et-overlay--dialog.et-sb-overlay-panel {
      background-color: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      border-radius: 12px;
    }
  `,
})
class OverlayBusyStorybookComponent {
  private overlays = injectOverlayManager();

  protected lastResult = signal<string | undefined>(undefined);

  protected open() {
    this.overlays
      .open<BusyOverlayComponent, string>(BusyOverlayComponent, {
        strategies: dialogOverlayStrategy(),
        panelClass: 'et-sb-overlay-panel',
      })
      .afterClosed()
      .pipe(tap((result) => this.lastResult.set(result ?? '(dismissed)')))
      .subscribe();
  }
}

export default {
  title: 'Components/Overlays/Overlay/Busy State',
  component: OverlayBusyStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [OverlayBusyStorybookComponent] }),
    applicationConfig({ providers: [provideOverlay()] }),
  ],
} as Meta<OverlayBusyStorybookComponent>;

type Story = StoryObj<OverlayBusyStorybookComponent>;

export const Default: Story = {};
