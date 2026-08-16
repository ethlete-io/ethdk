import { Component, ViewEncapsulation, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BANNER_IMPORTS, BUTTON_IMPORTS, BannerType, SpinnerComponent } from '@ethlete/components';
import { describeDayReviewGap, formatDurationMs } from '@ethlete/timetrack';
import { injectDayReview } from '../day-review/day-review';
import { formatDayRangeLabel, formatSignedDurationMs, formatWeekdayLabel } from '../day-review/format';
import { injectWeekReview, provideWeekReview } from './week-review';

@Component({
  selector: 'ethlete-week-review',
  template: `
    <div class="flex min-h-0 grow flex-col">
      <header class="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4">
        <div class="flex items-center gap-2">
          <button (click)="store.shiftWeek(-1)" et-button variant="outline" size="sm" aria-label="Previous week">
            ←
          </button>
          <h2 class="text-h3">{{ rangeLabel() }}</h2>
          <button (click)="store.shiftWeek(1)" et-button variant="outline" size="sm" aria-label="Next week">→</button>
          @if (!store.isThisWeek()) {
            <button (click)="store.goToThisWeek()" et-button variant="transparent" size="sm">This week</button>
          }
        </div>

        <button (click)="store.recorrelate()" et-button variant="outline" size="sm">Re-correlate</button>
      </header>

      @if (store.failure(); as failure) {
        <div class="shrink-0 px-6 pb-4">
          <et-banner [description]="failure" type="error" heading="This week could not be read" />
        </div>
      }

      @if (store.isLoading()) {
        <div class="flex items-center gap-3 px-6 text-et-surface-muted">
          <et-spinner />
          <span class="text-base">Reading the week…</span>
        </div>
      } @else if (store.week()) {
        @let state = banner();

        <div class="shrink-0 px-6 pb-4">
          <et-banner [description]="state.description" [heading]="state.heading" [type]="state.type" />
        </div>

        <ul class="flex min-h-0 grow list-none flex-col gap-2 overflow-y-auto px-6 pb-6">
          @for (day of days(); track day.key) {
            <li
              [class]="day.owes ? 'border-et-warning-ink' : 'border-et-surface-border'"
              class="grid grid-cols-[8.5rem_4.5rem_1fr_auto] items-center gap-x-4 rounded-md border px-3 py-2"
            >
              <span class="text-base whitespace-nowrap">{{ day.label }}</span>
              <span class="text-small">{{ day.proposed }}</span>
              <span [class]="day.owes ? 'text-et-warning-ink' : 'text-et-surface-muted'" class="text-small">
                {{ day.owes ?? day.state }}
              </span>

              <a (click)="dayReview.goToDay(day.key)" routerLink="/day" et-button variant="outline" size="sm">
                Review
              </a>
            </li>
          }
        </ul>

        <footer
          class="flex shrink-0 flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-et-surface-border px-6 py-3"
        >
          <span class="text-large">{{ proposed() }}</span>
          <span class="text-small text-et-surface-muted">of a {{ target() }} target ({{ delta() }})</span>
          <span class="text-small text-et-surface-muted">{{ workedDays() }} day(s) with work</span>
        </footer>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BANNER_IMPORTS, BUTTON_IMPORTS, RouterLink, SpinnerComponent],
  providers: [provideWeekReview()],
  host: { class: 'flex min-h-0 grow flex-col' },
})
export class WeekReviewViewComponent {
  protected dayReview = injectDayReview();
  protected store = injectWeekReview();

  protected rangeLabel = computed(() => formatDayRangeLabel(this.store.startDay(), this.store.endDay()));

  protected days = computed(() =>
    (this.store.week()?.days ?? []).map((day) => ({
      key: day.day,
      label: formatWeekdayLabel(day.day),
      proposed: formatDurationMs(day.proposedMs),
      owes: day.gap ? describeDayReviewGap(day.gap) : null,
      state: day.worked ? 'Logged' : 'Nothing observed',
    })),
  );

  protected proposed = computed(() => formatDurationMs(this.store.week()?.proposedMs ?? 0));
  protected target = computed(() => formatDurationMs(this.store.week()?.targetMs ?? 0));
  protected delta = computed(() => formatSignedDurationMs(this.store.week()?.deltaMs ?? 0));
  protected workedDays = computed(() => (this.store.week()?.days ?? []).filter((day) => day.worked).length);

  /**
   * A week nothing was collected in is not a finished week. Saying so is the only place a collector
   * that died over a whole week shows up as anything other than a suspiciously quiet list.
   */
  protected banner = computed((): { type: BannerType; heading: string; description: string } => {
    const owing = this.store.owing().length;

    if (owing > 0) {
      return {
        type: 'warning',
        heading: 'Some days are not finished',
        description: `${owing} day(s) in this week still need you.`,
      };
    }

    if (this.workedDays() === 0) {
      return {
        type: 'info',
        heading: 'Nothing was collected in this week',
        description: 'No day in this week saw any activity. The Sources view says what each collector is seeing.',
      };
    }

    return {
      type: 'success',
      heading: 'This week is finished',
      description: 'Every day this week that saw work is in Tempo as it reads here.',
    };
  });
}
