import { Component, ViewEncapsulation, computed } from '@angular/core';
import {
  ACCORDION_IMPORTS,
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  EMPTY_STATE_IMPORTS,
  SpinnerComponent,
} from '@ethlete/components';
import { Stream, formatDurationMs } from '@ethlete/timetrack';
import { formatClockTime, formatDayLabel } from '../day-review/format';
import { formatAgentSessions, formatSpend, formatStreamLabel, formatUnattended } from './format';
import { injectToday, provideToday } from './today';

@Component({
  selector: 'ethlete-today',
  template: `
    <div class="flex min-h-0 grow flex-col">
      <header class="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4">
        <div class="flex items-center gap-2">
          <button (click)="store.shiftDay(-1)" et-button variant="outline" size="sm" aria-label="Previous day">
            ←
          </button>
          <h2 class="text-h3">{{ dayLabel() }}</h2>
          <button (click)="store.shiftDay(1)" et-button variant="outline" size="sm" aria-label="Next day">→</button>
          @if (!store.isToday()) {
            <button (click)="store.goToToday()" et-button variant="transparent" size="sm">Today</button>
          }
        </div>
      </header>

      @if (store.failure(); as failure) {
        <div class="shrink-0 px-6 pb-4">
          <et-banner [description]="failure" type="error" heading="This day could not be read" />
        </div>
      }

      @if (store.isLoading()) {
        <div class="flex items-center gap-3 px-6 text-et-surface-muted">
          <et-spinner />
          <span class="text-base">Reading the day…</span>
        </div>
      } @else if (store.day(); as day) {
        <div
          class="flex shrink-0 flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-et-surface-border px-6 pb-4"
          data-totals
        >
          <span class="text-large" data-presence>{{ presence() }} present</span>
          <span class="text-large" data-engaged>{{ engaged() }} engaged</span>
          <span class="text-small text-et-surface-muted" data-concurrency>{{ concurrency() }} at once</span>
          @if (unattended(); as unattended) {
            <span class="text-small text-et-surface-subtle" data-unattended-total>+ {{ unattended }}</span>
          }
        </div>

        <div class="flex min-h-0 grow flex-col gap-4 overflow-y-auto px-6 py-4">
          @if (day.streams.length) {
            <et-accordion-group>
              @for (stream of day.streams; track stream.key) {
                <et-accordion [attr.data-stream]="stream.key">
                  <ng-template etAccordionLabel>
                    <span class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span class="text-mono text-et-surface-muted" data-span>{{ spanOf(stream) }}</span>
                      <span [title]="stream.repoPath ?? ''" class="text-base" data-label>{{ LABEL_OF(stream) }}</span>
                      <span class="text-small" data-engaged>{{ engagedOf(stream) }} engaged</span>
                      @if (UNATTENDED_OF(stream.unattendedMs); as unattended) {
                        <span class="text-small text-et-surface-subtle" data-unattended>{{ unattended }}</span>
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

                  @if (stream.branches.length) {
                    <ng-template etAccordionHint>
                      <span class="text-small" data-branches>{{ stream.branches.join(' · ') }}</span>
                    </ng-template>
                  }

                  <ul class="flex list-none flex-col gap-0.5">
                    @for (entry of stream.evidence; track entry.kind + entry.detail) {
                      <li class="text-small text-et-surface-muted">
                        <span class="text-mono">{{ CLOCK_OF(entry.at) }}</span>
                        {{ entry.detail }}
                      </li>
                    } @empty {
                      <li class="text-small text-et-surface-subtle">No evidence was recorded for this stream.</li>
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

          @if (unattributed(); as spend) {
            <div class="flex flex-col gap-1 rounded-md border border-dashed border-et-surface-border px-3 py-2">
              <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span class="text-base" data-unattributed-label>No checkout for this spend</span>
                <span class="text-small text-et-surface-muted" data-unattributed>{{ spend }}</span>
              </div>

              <span class="text-small text-et-surface-subtle">
                These turns name no working directory, so no line can carry them.
              </span>
            </div>
          }
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ACCORDION_IMPORTS, BANNER_IMPORTS, BUTTON_IMPORTS, EMPTY_STATE_IMPORTS, SpinnerComponent],
  providers: [provideToday()],
  host: { class: 'flex min-h-0 grow flex-col' },
})
export class TodayViewComponent {
  protected store = injectToday();

  protected dayLabel = computed(() => formatDayLabel(this.store.dayKey()));
  protected presence = computed(() => formatDurationMs(this.store.day()?.presenceMs ?? 0));
  protected engaged = computed(() => formatDurationMs(this.store.day()?.engagedMs ?? 0));
  protected concurrency = computed(() => `${(this.store.day()?.concurrency ?? 0).toFixed(1)}×`);
  protected unattended = computed(() => formatUnattended(this.store.day()?.unattendedMs ?? 0));

  /**
   * The turns that name no checkout. Without it the day does not reconcile: the lines and this
   * remainder together are the whole of what the agents spent.
   */
  protected unattributed = computed(() => {
    const day = this.store.day();

    return day ? formatSpend(day.unattributedSpend) : '';
  });

  protected readonly LABEL_OF = formatStreamLabel;
  protected readonly SPEND_OF = formatSpend;
  protected readonly SESSIONS_OF = formatAgentSessions;
  protected readonly CLOCK_OF = formatClockTime;
  protected readonly UNATTENDED_OF = formatUnattended;

  protected engagedOf(stream: Stream) {
    return formatDurationMs(stream.engagedMs);
  }

  protected spanOf(stream: Stream) {
    return `${formatClockTime(stream.from)} – ${formatClockTime(stream.to)}`;
  }
}
