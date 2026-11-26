import { Component, ViewEncapsulation, input, model } from '@angular/core';
import { ButtonComponent } from '../button/button.component';
import { injectBracketLabels } from './bracket-labels';

/** One entry of an `et-bracket-participants` legend. */
export type BracketParticipantsEntry = {
  id: string;
  name: string;
};

/**
 * A participants legend with one pin toggle per participant. Bind `focusedParticipantId` two-way to
 * the same signal as the bracket's, so a toggle pins that participant's journey and a second press
 * drops it.
 *
 * @example
 * <et-bracket-participants [participants]="teams()" [(focusedParticipantId)]="focusedTeamId" />
 * <et-bracket [(focusedParticipantId)]="focusedTeamId" [source]="source()" />
 */
@Component({
  selector: 'et-bracket-participants',
  template: `
    @for (participant of participants(); track participant.id) {
      <button
        [pressed]="focusedParticipantId() === participant.id"
        (click)="togglePin(participant.id)"
        class="et-bracket-participants-toggle"
        et-button
        size="sm"
        variant="outline"
        type="button"
      >
        {{ participant.name }}
      </button>
    }
  `,
  styleUrl: './bracket-participants.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ButtonComponent],
  host: {
    class: 'et-bracket-participants',
    role: 'group',
    '[attr.aria-label]': 'labels().participantsLegend',
  },
})
export class BracketParticipantsComponent {
  protected labels = injectBracketLabels();

  public participants = input.required<readonly BracketParticipantsEntry[]>();

  /** Two-way. The pinned participant, shared with the bracket's own `focusedParticipantId`. */
  public focusedParticipantId = model<string | null>(null);

  protected togglePin(participantId: string) {
    this.focusedParticipantId.update((current) => (current === participantId ? null : participantId));
  }
}
