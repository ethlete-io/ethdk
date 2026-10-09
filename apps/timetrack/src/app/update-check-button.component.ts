import { Component, ViewEncapsulation, computed, isDevMode } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { injectUpdateCheck } from './update-check';

const LABELS = {
  idle: 'Check for updates',
  checking: 'Checking…',
  current: 'Up to date · check again',
  failed: 'Check failed · retry',
} as const;

/** Checks for a newer release on request; the titlebar offers the restart once one is downloaded. */
@Component({
  selector: 'ethlete-update-check-button',
  template: `
    @if (!devMode && !update.version()) {
      <button
        [disabled]="update.state() === 'checking'"
        (click)="update.check()"
        et-button
        variant="transparent"
        size="sm"
        data-update-check
      >
        {{ label() }}
      </button>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class UpdateCheckButtonComponent {
  protected update = injectUpdateCheck();
  protected devMode = isDevMode();
  protected label = computed(() => LABELS[this.update.state()]);
}
