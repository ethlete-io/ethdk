import { Component, ViewEncapsulation, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { EMPTY, catchError, take } from 'rxjs';
import { WidgetReadout, injectHostPorts } from '../../host';
import { injectCollectionPause } from '../collection-pause';
import { injectWindowLock } from '../window-lock';

/** How a confidence reads to somebody glancing at it, rather than the word the model uses. */
const CONFIDENCE_WORDING: Record<NonNullable<WidgetReadout['confidence']>, string> = {
  certain: 'the branch names it',
  likely: 'a good guess',
  weak: 'a guess',
};

/**
 * The floating readout: one always-on-top window saying what is being recorded, where it goes, and
 * how sure of that the day is.
 *
 * It computes nothing. The app window reconstructs today already and publishes the result, so this
 * window holds no collector, no store and no correlation — which is what makes a second window safe:
 * two of them collecting would write every event twice.
 */
@Component({
  selector: 'ethlete-widget',
  template: `
    <div class="flex h-dvh flex-col gap-2 border border-et-surface-border p-3" data-tauri-drag-region="deep">
      @if (lock.isLocked() || !lock.ready()) {
        <div class="flex items-start justify-between gap-2">
          <span class="text-small font-medium">Locked</span>
          <button (click)="close()" et-button variant="transparent" size="sm" aria-label="Hide the readout">✕</button>
        </div>
      } @else if (readout(); as now) {
        <div class="flex items-start justify-between gap-2">
          <span class="text-small font-medium">{{ now.label }}</span>
          <button (click)="close()" et-button variant="transparent" size="sm" aria-label="Hide the readout">✕</button>
        </div>

        <div class="flex min-h-8 flex-col">
          @if (now.issueKey) {
            <span class="text-small">
              {{ now.issueKey }}
              <span class="text-et-surface-muted">— {{ confidence() }}</span>
            </span>
          } @else if (now.state === 'working') {
            <span class="text-small text-et-surface-muted">No issue names this work yet.</span>
          }

          @if (now.since) {
            <span class="text-small text-et-surface-subtle">Since {{ now.since }}</span>
          }
        </div>

        <span class="text-small text-et-surface-subtle">{{ now.total }}</span>
      } @else {
        <span class="text-small text-et-surface-muted">Reading today…</span>
      }

      <div class="mt-auto flex items-center gap-2">
        <button [variant]="pause.isPaused() ? 'filled' : 'outline'" (click)="pause.toggle()" et-button size="sm">
          {{ pause.isPaused() ? 'Resume' : 'Pause' }}
        </button>

        <button (click)="reveal()" et-button variant="transparent" size="sm">Open Timetrack</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class WidgetComponent {
  protected pause = injectCollectionPause();
  protected lock = injectWindowLock();

  private ports = injectHostPorts();

  protected readout = toSignal(this.ports.widget.readout$(), { initialValue: null });

  protected confidence = computed(() => {
    const held = this.readout()?.confidence;

    return held ? CONFIDENCE_WORDING[held] : '';
  });

  constructor() {
    // The readout is published on change, so a window opened between two changes has to ask for it.
    this.ports.widget
      .announceReady$()
      .pipe(
        take(1),
        catchError(() => EMPTY),
      )
      .subscribe();
  }

  protected close() {
    this.ports.widget
      .close$()
      .pipe(
        take(1),
        catchError(() => EMPTY),
      )
      .subscribe();
  }

  protected reveal() {
    this.ports.widget
      .revealApp$()
      .pipe(
        take(1),
        catchError(() => EMPTY),
      )
      .subscribe();
  }
}
