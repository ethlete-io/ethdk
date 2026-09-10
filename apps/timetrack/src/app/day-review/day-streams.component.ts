import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { ACCORDION_IMPORTS, EMPTY_STATE_IMPORTS } from '@ethlete/components';
import { Stream, StreamDay, formatDurationMs } from '@ethlete/timetrack';
import { formatClockTime } from './format';
import {
  formatAgentSessions,
  formatBranches,
  formatRebuilt,
  formatSpend,
  formatStreamLabel,
  formatUnattended,
} from './stream-format';

/**
 * The evidence under the day's bands: one line per checkout, with what it engaged, what its agents
 * spent and what was observed in it.
 *
 * It is a stream and never a row, so nothing here can be cut, named or booked — a stream is keyed by
 * its checkout under ADR 0001. It scrolls inside a bounded height, so a day of twenty checkouts costs
 * the timeline above it no more room than a day of three.
 */
@Component({
  selector: 'ethlete-day-streams',
  template: `
    <details class="rounded-md border border-et-surface-border" data-streams open>
      <summary class="cursor-pointer px-3 py-2 text-small text-et-surface-muted">{{ summary() }}</summary>

      <div class="max-h-64 overflow-y-auto px-3 pb-3">
        @if (streams().length) {
          <et-accordion-group>
            @for (stream of streams(); track stream.key) {
              <et-accordion [attr.data-stream]="stream.key">
                <ng-template etAccordionLabel>
                  <span class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span class="text-mono text-et-surface-muted" data-span>{{ spanOf(stream) }}</span>
                    <span [title]="stream.repoPath ?? ''" class="text-base" data-label>{{ LABEL_OF(stream) }}</span>
                    <span class="text-small" data-engaged>{{ engagedOf(stream) }} engaged</span>
                    @if (UNATTENDED_OF(stream.unattendedMs); as unattended) {
                      <span class="text-small text-et-surface-subtle" data-unattended>{{ unattended }}</span>
                    }
                    @if (REBUILT_OF(stream.rebuiltMs); as rebuilt) {
                      <span class="text-small text-et-brand-ink" data-rebuilt>{{ rebuilt }}</span>
                    }
                    @if (SESSIONS_OF(stream); as sessions) {
                      <span class="text-small text-et-surface-muted" data-agent-sessions>{{ sessions }}</span>
                    }
                    @if (SPEND_OF(stream.spend); as spend) {
                      <span class="text-small text-et-surface-muted" data-spend>{{ spend }}</span>
                    }
                    @if (stream.neverFocused) {
                      <span class="text-small text-et-surface-subtle" data-never-focused>
                        agent only, never focused
                      </span>
                    }
                  </span>
                </ng-template>

                @if (branchesOf(stream); as branches) {
                  <ng-template etAccordionHint>
                    <span [title]="branches" class="block max-w-96 truncate text-small" data-branches>
                      {{ branches }}
                    </span>
                  </ng-template>
                }

                <ul class="flex list-none flex-col gap-0.5">
                  @for (entry of stream.evidence; track entry.kind + entry.detail) {
                    <li [title]="entry.detail" class="flex gap-2 text-small text-et-surface-muted">
                      <span class="text-mono shrink-0">{{ CLOCK_OF(entry.at) }}</span>
                      <span class="min-w-0 truncate">{{ entry.detail }}</span>
                    </li>
                  } @empty {
                    <li class="text-small text-et-surface-subtle">No evidence was recorded for this stream.</li>
                  }

                  @if (stream.evidenceOmitted) {
                    <li class="text-small text-et-surface-subtle" data-evidence-omitted>
                      and {{ stream.evidenceOmitted }} more, not listed
                    </li>
                  }
                </ul>
              </et-accordion>
            }
          </et-accordion-group>
        } @else {
          <et-empty-state
            description="Nothing observed this day. A collector that was not running records nothing after the fact."
            heading="No streams"
          />
        }
      </div>
    </details>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ACCORDION_IMPORTS, EMPTY_STATE_IMPORTS],
})
export class DayStreamsComponent {
  public day = input.required<StreamDay | null>();
  /** The branch a checkout the day named none for was on, by checkout path. */
  public headBranches = input<Record<string, string>>({});

  protected streams = computed(() => this.day()?.streams ?? []);

  /** What the summary line says, so the day's shape stays readable when the panel is collapsed. */
  protected summary = computed(() => {
    const count = this.streams().length;

    if (!count) return 'Streams — nothing observed';

    return `Streams — ${count} ${count === 1 ? 'checkout' : 'checkouts'}, ${formatDurationMs(
      this.day()?.engagedMs ?? 0,
    )} engaged`;
  });

  protected readonly LABEL_OF = formatStreamLabel;
  protected readonly SPEND_OF = formatSpend;
  protected readonly SESSIONS_OF = formatAgentSessions;
  protected readonly CLOCK_OF = formatClockTime;
  protected readonly UNATTENDED_OF = formatUnattended;
  protected readonly REBUILT_OF = formatRebuilt;

  protected engagedOf(stream: Stream) {
    return formatDurationMs(stream.engagedMs);
  }

  protected spanOf(stream: Stream) {
    return `${formatClockTime(stream.from)} – ${formatClockTime(stream.to)}`;
  }

  protected branchesOf(stream: Stream) {
    return formatBranches({ stream, headBranches: this.headBranches() });
  }
}
