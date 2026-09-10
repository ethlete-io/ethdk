import {
  Component,
  Directive,
  Injector,
  ViewEncapsulation,
  WritableSignal,
  computed,
  inject,
  input,
} from '@angular/core';
import { Appointment, BUTTON_IMPORTS, injectSchedulerEditSurfaceHost } from '@ethlete/components';
import { MeetingMatch } from '@ethlete/timetrack';
import { injectDayReview } from '../day-review';
import { formatClockTime } from '../format';

/** One of the day's meetings, as the field offers it. */
type MeetingOffer = {
  id: string;
  title: string;
  clock: string;
  issueKey: string;
  from: Date;
  to: Date;
};

/**
 * The day's own meetings, offered to a row being written by hand.
 *
 * It is the case this answers most often — a meeting held away from the desk leaves no evidence at
 * all — and the calendar already knows both its times and its title, so retyping either is waste.
 */
@Component({
  selector: 'ethlete-edit-meeting',
  template: `
    <div class="flex flex-col gap-2">
      <span class="text-small">A meeting on this day is not on the timesheet yet.</span>

      @for (offer of offers(); track offer.id) {
        <div class="flex flex-wrap items-center gap-3">
          <span class="w-28 shrink-0 text-mono text-small text-et-surface-subtle">{{ offer.clock }}</span>
          <span class="min-w-40 grow truncate text-small">{{ offer.title }}</span>
          <button (click)="take(offer)" et-button variant="outline" size="sm">
            {{ offer.issueKey ? 'Use ' + offer.issueKey : 'Use its time' }}
          </button>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class EditMeetingComponent {
  private store = injectDayReview();

  public draft = input.required<WritableSignal<Appointment>>();

  protected offers = computed(() => this.store.meetings().map(offerOf));

  protected take(offer: MeetingOffer) {
    this.draft().update((appointment) => ({
      ...appointment,
      title: offer.issueKey || appointment.title,
      description: offer.title,
      start: offer.from,
      end: offer.to,
    }));
  }
}

@Directive({ selector: '[ethleteEditMeeting]' })
export class EditMeetingDirective {
  private host = injectSchedulerEditSurfaceHost('ethleteEditMeeting');
  private store = injectDayReview();

  constructor() {
    this.host.registerEditField({
      component: EditMeetingComponent,
      injector: inject(Injector),
      order: -10,
      enabled: computed(() => this.store.meetings().length > 0),
    });
  }
}

const offerOf = (meeting: MeetingMatch): MeetingOffer => ({
  id: `${meeting.event.at.getTime()}|${meeting.event.title}`,
  title: meeting.event.title,
  clock: `${formatClockTime(meeting.event.at)} – ${formatClockTime(meeting.event.until)}`,
  issueKey: meeting.group.issueKey ?? '',
  from: meeting.event.at,
  to: meeting.event.until,
});
