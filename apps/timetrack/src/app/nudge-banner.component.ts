import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { injectDayNudge } from './day-nudge';

/**
 * The reminder as the open window shows it, under the titlebar and above every view.
 *
 * It stays up until the day is finished, unlike the notification behind it: the notification is an
 * interruption and may only interrupt once an hour, while a banner the user is looking at costs
 * nothing and disappears on its own the moment the last row reaches Tempo.
 */
@Component({
  selector: 'ethlete-nudge-banner',
  template: `
    @if (nudge.pending(); as pending) {
      <div
        class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-et-surface-border bg-et-brand/10 px-3 py-2"
        role="status"
      >
        <p class="text-small">
          <span class="font-medium">{{ pending.title }}</span>
          — {{ pending.body }}
        </p>

        <div class="flex items-center gap-2">
          <a routerLink="/day" et-button variant="filled" size="sm">Review the day</a>
          <button (click)="nudge.later()" et-button variant="outline" size="sm">Later</button>
          <button (click)="nudge.notToday()" et-button variant="transparent" size="sm">Not today</button>
        </div>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, RouterLink],
})
export class NudgeBannerComponent {
  protected nudge = injectDayNudge();
}
