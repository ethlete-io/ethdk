import { Component, ViewEncapsulation, computed, isDevMode } from '@angular/core';
import { injectUpdateCheck } from './update-check';

const LABELS = {
  idle: 'Check for updates',
  checking: 'Checking…',
  current: 'Up to date · check again',
  failed: 'Check failed · retry',
} as const;

/** Checks for a newer release on request; the update button offers the restart once one is downloaded. */
@Component({
  selector: 'ethlete-update-check-button',
  template: `
    @if (!devMode && !update.version()) {
      <button
        [disabled]="update.state() === 'checking'"
        (click)="update.check()"
        class="studio__verb"
        type="button"
        data-update-check
      >
        {{ label() }}
      </button>
    }
  `,
  encapsulation: ViewEncapsulation.None,
})
export class UpdateCheckButtonComponent {
  protected update = injectUpdateCheck();
  protected devMode = isDevMode();
  protected label = computed(() => LABELS[this.update.state()]);
}
