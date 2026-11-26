import { Component, ViewEncapsulation, DestroyRef, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BUTTON_IMPORTS,
  CHOICE_FIELD_IMPORTS,
  DURATION_INPUT_IMPORTS,
  FORM_FIELD_IMPORTS,
  SELECT_IMPORTS,
  SWITCH_IMPORTS,
} from '@ethlete/components';
import { ClockStyle, DateStyle } from '@ethlete/timetrack';
import { injectDayNudge } from '../day-nudge';
import { ExplainComponent } from './explain.component';
import { PriceTableComponent } from './price-table.component';
import { injectTimetrackSettings } from './settings';

const DAY_START_WHY = `Work at 01:00 belongs to the evening it came from, not to a two-hour Tuesday that
describes nothing you did. Set the hour your day begins and every screen, total and booking follows it.

Midnight makes a day a calendar date again. The cap is noon, because past that a day would start after
most of it had happened.`;

const FILL_WHY = `A pause shorter than this is logged as the work around it: five minutes without a
keystroke is reading a diff, not a break. Anything longer stays off the timesheet.

Set it to zero to fill nothing. The cap is half an hour, because the day ends a block after 30
unobserved minutes — a longer gap is a stretch nothing watched at all, and claiming it would be inventing
time rather than reading evidence.`;

const NUDGE_WHY = `The reminder arrives as a desktop notification and as a banner in the window. It is only
ever about today, and only while something is still owed.

A development build posts under the terminal, because an unbundled binary has no identity of its own to
post under.`;

const STAND_IN_OVERDUE_WHY = `A stand-in is work you named before Jira had a ticket for it. Either limit
alone marks one: work that sat for a week, and work that piled up four hours in two days, are both debts
worth naming.

Nothing is blocked and nothing notifies. The list marks it and the day header counts it. A weekend does
not age a stand-in, and the held time is read from the days it covers. Set either one to zero to turn
that limit off.`;

const NO_STAND_IN_WHY = `Deleting a stand-in the app opened refuses the branch it stood for. The work
there is still unnamed, so without that refusal the next pass would open another one within seconds
and the list could never be cleared. An entry naming no branch refuses a whole checkout, which is
what a delete wrote while stand-ins covered one.

Allow it again and the app opens a stand-in for that work the next time it sees any.`;

const WORKDAY_LADDER = [0, 1, 2, 3, 5, 10, 20];

@Component({
  selector: 'ethlete-settings-day-view',
  template: `
    <div class="flex max-w-3xl flex-col gap-8 py-6">
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-end gap-3">
          <et-form-field class="w-30" appearance="underline" size="sm">
            <et-label>Target</et-label>
            <et-duration-input
              [value]="store.settings().dayTargetMs"
              (valueChange)="store.setDayTargetMs($event ?? 0)"
              durationFormat="hh:mm"
            />
          </et-form-field>

          <div class="flex items-end">
            <et-form-field class="w-30" appearance="underline" size="sm">
              <et-label>Fill idle up to</et-label>
              <et-duration-input
                [value]="store.settings().gapFillMs"
                (valueChange)="store.setGapFillMs($event ?? 0)"
                durationFormat="hh:mm"
              />
            </et-form-field>
            <ethlete-explain [text]="FILL_WHY" label="filling idle time" />
          </div>

          <div class="flex items-end">
            <et-form-field class="w-30" appearance="underline" size="sm">
              <et-label>A day starts at</et-label>
              <et-duration-input
                [value]="dayStartMs()"
                (valueChange)="store.setDayStartHour(($event ?? 0) / 3_600_000)"
                durationFormat="hh:mm"
              />
            </et-form-field>
            <ethlete-explain [text]="DAY_START_WHY" label="when a day starts" />
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="text-h4">How dates and times read</h3>

        <div class="flex flex-wrap items-end gap-3">
          <et-form-field class="w-48" appearance="underline" size="sm">
            <et-label>Date</et-label>
            <et-select
              [value]="store.settings().display.dateStyle"
              (valueChange)="store.setDateStyle($event)"
              data-date-style
            >
              @for (option of DATE_STYLE_OPTIONS; track option.value) {
                <et-select-option [value]="option.value" [label]="option.label" />
              }
            </et-select>
          </et-form-field>

          <et-form-field class="w-48" appearance="underline" size="sm">
            <et-label>Clock</et-label>
            <et-select [value]="store.settings().display.clock" (valueChange)="store.setClock($event)" data-clock-style>
              @for (option of CLOCK_STYLE_OPTIONS; track option.value) {
                <et-select-option [value]="option.value" [label]="option.label" />
              }
            </et-select>
          </et-form-field>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-1">
          <h3 class="text-h4">The end-of-day reminder</h3>
          <ethlete-explain [text]="NUDGE_WHY" label="the end-of-day reminder" />
        </div>

        <et-choice-field>
          <et-switch [checked]="store.settings().nudge.enabled" (checkedChange)="store.setNudgeEnabled($event)" />
          <et-label>Say when today is not finished</et-label>
        </et-choice-field>

        <div class="flex flex-wrap items-end gap-3">
          <et-form-field class="w-30" appearance="underline" size="sm">
            <et-label>Remind at</et-label>
            <et-duration-input
              [value]="nudgeAtMs()"
              (valueChange)="store.setNudgeAtMinute(($event ?? 0) / 60_000)"
              durationFormat="hh:mm"
            />
          </et-form-field>

          <button (click)="sendTestNudge()" et-button variant="outline" size="sm">Send a test reminder</button>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-1">
          <h3 class="text-h4">When a stand-in waited long enough</h3>
          <ethlete-explain [text]="STAND_IN_OVERDUE_WHY" label="marking a stand-in" />
        </div>

        <div class="flex flex-wrap items-end gap-3">
          <et-form-field class="w-48" appearance="underline" size="sm">
            <et-label>Older than</et-label>
            <et-select [value]="overdueWorkdays()" (valueChange)="store.setStandInOverdueWorkdays(+$event)">
              @for (option of workdayOptions(); track option.value) {
                <et-select-option [value]="option.value" [label]="option.label">
                  {{ option.label }}
                </et-select-option>
              }
            </et-select>
          </et-form-field>

          <et-form-field class="w-30" appearance="underline" size="sm">
            <et-label>Or holding</et-label>
            <et-duration-input
              [value]="store.settings().standIn.overdueAfterMs"
              (valueChange)="store.setStandInOverdueMs($event ?? 0)"
              durationFormat="hh:mm"
            />
          </et-form-field>
        </div>
      </div>

      @if (store.settings().noStandInCheckouts; as refused) {
        @if (refused.length) {
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-1">
              <h3 class="text-h4">Work that gets no stand-in</h3>
              <ethlete-explain [text]="NO_STAND_IN_WHY" label="refusing a stand-in" />
            </div>

            <div class="flex flex-col gap-2">
              @for (
                entry of refused;
                track entry.repoPath + '@' + (entry.branch ?? '') + '#' + (entry.workPath ?? '')
              ) {
                <div [attr.data-no-stand-in]="entry.repoPath" class="flex items-center gap-3">
                  <span class="min-w-0 grow truncate text-mono text-small">
                    {{ entry.repoPath }}{{ entry.branch ? ' · ' + entry.branch : ''
                    }}{{ entry.workPath ? ' · ' + entry.workPath : '' }}
                  </span>

                  <button (click)="store.allowStandInCheckout(entry)" et-button variant="outline" size="sm">
                    Allow again
                  </button>
                </div>
              }
            </div>
          </div>
        }
      }

      <ethlete-price-table
        [table]="store.settings().priceTable"
        (currencyChange)="store.setPriceCurrency($event)"
        (add)="store.addModelPrice($event)"
        (remove)="store.removeModelPrice($event)"
      />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    CHOICE_FIELD_IMPORTS,
    DURATION_INPUT_IMPORTS,
    ExplainComponent,
    FORM_FIELD_IMPORTS,
    PriceTableComponent,
    SELECT_IMPORTS,
    SWITCH_IMPORTS,
  ],
})
export class SettingsDayViewComponent {
  protected store = injectTimetrackSettings();
  private dayNudge = injectDayNudge();
  private destroyRef = inject(DestroyRef);

  protected readonly DAY_START_WHY = DAY_START_WHY;
  protected readonly FILL_WHY = FILL_WHY;
  protected readonly NUDGE_WHY = NUDGE_WHY;
  protected readonly STAND_IN_OVERDUE_WHY = STAND_IN_OVERDUE_WHY;
  protected readonly NO_STAND_IN_WHY = NO_STAND_IN_WHY;

  /** The reminder is configured as a time of day, and the control it is typed into holds a duration. */
  protected nudgeAtMs = computed(() => this.store.settings().nudge.atMinute * 60_000);

  protected readonly DATE_STYLE_OPTIONS: { value: DateStyle; label: string }[] = [
    { value: 'day-month', label: '7 Oct' },
    { value: 'month-day', label: 'Oct 7' },
    { value: 'iso', label: '2026-10-07' },
  ];

  protected readonly CLOCK_STYLE_OPTIONS: { value: ClockStyle; label: string }[] = [
    { value: '24h', label: '24-hour (21:45)' },
    { value: '12h', label: '12-hour (9:45 PM)' },
  ];

  protected dayStartMs = computed(() => this.store.settings().dayStartHour * 3_600_000);

  /** The select answers in strings, and the setting is a count. */
  protected overdueWorkdays = computed(() => `${this.store.settings().standIn.overdueAfterWorkdays}`);

  /** A hand-edited count the ladder does not hold is added to it, so the control never reads blank. */
  protected workdayOptions = computed(() =>
    [...new Set([...WORKDAY_LADDER, this.store.settings().standIn.overdueAfterWorkdays])]
      .sort((left, right) => left - right)
      .map((workdays) => ({
        value: `${workdays}`,
        label: workdays === 0 ? 'Never by age' : `${workdays} workday${workdays === 1 ? '' : 's'}`,
      })),
  );

  protected sendTestNudge() {
    this.dayNudge.sendTest$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
}
