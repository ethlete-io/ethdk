import { Component, ViewEncapsulation, computed, input, linkedSignal, output } from '@angular/core';
import { BUTTON_IMPORTS, DURATION_INPUT_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
import { ManualRow, MeetingMatch, formatDurationMs } from '@ethlete/timetrack';
import { startOfDay } from 'date-fns';
import { IssueFilterComponent, IssueSelectComponent } from '../jira';
import { formatClockTime } from './format';

const DAY_MS = 24 * 60 * 60_000;
const MINUTE_MS = 60_000;

/** The range an entry covers, before it is a row. */
export type EntryRange = { from: Date; to: Date };

/** One of the day's meetings, as the panel offers it. */
type MeetingOffer = {
  id: string;
  title: string;
  clock: string;
  issueKey: string;
  from: Date;
  to: Date;
};

/**
 * Adds a row for work nothing observed.
 *
 * It exists because the day review could only ever edit what the collectors saw. A meeting held away
 * from the desk, an hour on somebody else's machine and a phone call are all real work that leaves no
 * evidence at all, and the only way to put them on the day used to be to stretch a row that meant
 * something else.
 *
 * The day's own meetings are offered first, because that is the case this answers most often and the
 * calendar already knows both the times and the title.
 */
@Component({
  selector: 'ethlete-add-entry',
  template: `
    <div class="flex flex-col gap-3 rounded-md border border-et-brand-ink p-3">
      <div class="flex flex-wrap items-baseline gap-3">
        <h4 class="grow text-h4">Add an entry</h4>
        <span class="text-small text-et-surface-muted">{{ clock() }} · {{ duration() }}</span>
        <button (click)="dismiss.emit()" et-button variant="transparent" size="sm">Close</button>
      </div>

      @if (offers().length) {
        <div class="flex flex-col gap-2 rounded-md border border-et-surface-border p-3">
          <span class="text-small">A meeting on this day is not on the timesheet yet.</span>

          @for (offer of offers(); track offer.id) {
            <div class="flex flex-wrap items-center gap-3">
              <span class="w-28 shrink-0 text-mono text-small text-et-surface-subtle">{{ offer.clock }}</span>
              <span class="min-w-40 grow truncate text-small">{{ offer.title }}</span>
              <button
                [disabled]="!offer.issueKey && !issueKey()"
                (click)="addMeeting(offer)"
                et-button
                variant="outline"
                size="sm"
              >
                {{ offer.issueKey ? 'Log on ' + offer.issueKey : 'Log on the issue above' }}
              </button>
            </div>
          }
        </div>
      }

      <div class="flex flex-col gap-1">
        <span class="text-small text-et-surface-muted">Issue</span>
        <ethlete-issue-select
          [value]="issueKey()"
          (valueChange)="issueKey.set($event)"
          ariaLabel="The issue this entry is logged against"
        />
      </div>

      <ethlete-issue-filter />

      <div class="flex flex-wrap items-end gap-3">
        <et-form-field class="w-26" appearance="underline" size="sm">
          <et-label>Starts</et-label>
          <et-duration-input [value]="startOfDayMs()" (valueChange)="setStart($event ?? 0)" durationFormat="hh:mm" />
        </et-form-field>

        <et-form-field class="w-26" appearance="underline" size="sm">
          <et-label>Logs</et-label>
          <et-duration-input
            [value]="durationMs()"
            (valueChange)="durationMs.set($event ?? 0)"
            durationFormat="hh:mm"
          />
        </et-form-field>

        <et-form-field class="min-w-50 grow" appearance="underline" size="sm">
          <et-label>Description</et-label>
          <et-input [(value)]="description" placeholder="What was done" />
        </et-form-field>
      </div>

      <div class="flex items-center gap-3">
        <button [disabled]="!canAdd()" (click)="add()" et-button variant="filled" size="sm">Add the entry</button>

        <span class="text-small text-et-surface-muted">
          Nothing observed this, so it counts as time you stated rather than time that was seen.
        </span>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    DURATION_INPUT_IMPORTS,
    FORM_FIELD_IMPORTS,
    INPUT_IMPORTS,
    IssueFilterComponent,
    IssueSelectComponent,
  ],
})
export class AddEntryComponent {
  /** The range the entry covers — what was drawn on the timeline, or the hour a press asked for. */
  public range = input.required<EntryRange>();
  /** The day's meetings the rows do not hold yet. */
  public meetings = input<readonly MeetingMatch[]>([]);
  /** The issue the range's own surroundings suggest, so the field is answered rather than only asked. */
  public suggestedIssueKey = input('');

  public entry = output<ManualRow>();
  public dismiss = output<void>();

  protected offers = computed(() => meetingOffers(this.meetings()));

  /** Reset whenever another range is drawn: the panel then describes that range, not the last one. */
  protected issueKey = linkedSignal(() => this.suggestedIssueKey());
  private from = linkedSignal(() => this.range().from);
  protected durationMs = linkedSignal(() => this.range().to.getTime() - this.range().from.getTime());
  protected description = linkedSignal(() => '');

  /** The end follows the start and the duration: a row's clock span is what its duration is read from. */
  private to = computed(() => new Date(this.from().getTime() + this.durationMs()));

  protected clock = computed(() => `${formatClockTime(this.from())} – ${formatClockTime(this.to())}`);
  protected duration = computed(() => formatDurationMs(this.durationMs()));
  protected canAdd = computed(() => !!this.issueKey() && this.durationMs() > 0);

  /**
   * The start as a time of day, which is what the control it is typed into holds. A row cannot cross
   * midnight — a day's review is one day — so the date part is the day the range was drawn on.
   */
  protected startOfDayMs = computed(() => this.from().getTime() - startOfDay(this.from()).getTime());

  protected setStart(ofDayMs: number) {
    this.from.set(new Date(startOfDay(this.from()).getTime() + Math.min(ofDayMs, DAY_MS - MINUTE_MS)));
  }

  protected addMeeting(offer: MeetingOffer) {
    this.entry.emit({
      issueKey: offer.issueKey || this.issueKey(),
      description: offer.title,
      from: offer.from,
      to: offer.to,
    });
  }

  protected add() {
    this.entry.emit({
      issueKey: this.issueKey(),
      description: this.description(),
      from: this.from(),
      to: this.to(),
      durationMs: this.durationMs(),
    });
  }
}

const meetingOffers = (meetings: readonly MeetingMatch[]): MeetingOffer[] =>
  meetings.map((meeting) => ({
    id: `${meeting.event.at.getTime()}|${meeting.event.title}`,
    title: meeting.event.title,
    clock: `${formatClockTime(meeting.event.at)} – ${formatClockTime(meeting.event.until)}`,
    issueKey: meeting.group.issueKey ?? '',
    from: meeting.event.at,
    to: meeting.event.until,
  }));
