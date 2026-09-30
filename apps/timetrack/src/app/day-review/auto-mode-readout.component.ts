import { Component, ViewEncapsulation, input } from '@angular/core';
import { AutoModeReadoutEntry, AutoModeReadoutStatus } from '@ethlete/timetrack';
import { formatClockTime } from './format';

const STATUS_TEXT: Record<AutoModeReadoutStatus, string> = {
  applied: 'applied',
  approved: 'approved',
  waiting: 'waits for your approval',
  rejected: 'rejected',
  expired: 'expired unapproved',
  filed: 'filed',
  held: 'held, set to never',
  overruled: 'you named it yourself',
  unused: 'found, not applied',
  done: 'is done, left to you',
  'not-queued': 'drafted, not queued',
  written: 'described',
  unsure: 'unsure, left to you',
  failed: 'the ask failed',
};

@Component({
  selector: 'ethlete-auto-mode-readout',
  template: `
    @if (entries().length) {
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        @for (entry of entries(); track entry.key) {
          <li [attr.data-auto-entry]="entry.key" [attr.data-status]="entry.status" class="flex flex-col text-small">
            <span>
              {{ askedAt(entry) }} · {{ entry.label }}:
              @if (entry.issueKey) {
                {{ entry.issueKey }}
              }
              {{ statusText(entry) }}
              @if (entry.namedRows) {
                ({{ entry.namedRows }} row(s))
              }
            </span>

            @if (entry.summary) {
              <span class="text-et-surface-muted">Draft: {{ entry.summary }}</span>
            }

            @if (entry.reason) {
              <span class="text-et-surface-muted">Why: {{ entry.reason }}</span>
            }

            @if (entry.description) {
              <span class="text-et-surface-muted">Worklog: {{ entry.description }}</span>
            }

            @if (entry.error) {
              <span class="text-et-error">{{ entry.error }}</span>
            }
          </li>
        }
      </ul>
    } @else {
      <p class="text-small text-et-surface-muted">Auto mode asked about nothing on this day.</p>
    }
  `,
  encapsulation: ViewEncapsulation.None,
})
export class AutoModeReadoutComponent {
  public entries = input.required<readonly AutoModeReadoutEntry[]>();

  protected askedAt(entry: AutoModeReadoutEntry) {
    return formatClockTime(new Date(entry.askedAtMs));
  }

  protected statusText(entry: AutoModeReadoutEntry) {
    return STATUS_TEXT[entry.status];
  }
}
