import { Component, signal, ViewEncapsulation } from '@angular/core';
import {
  BRACKET_DEFAULT_CARDS,
  BRACKET_IMPORTS,
  BRACKET_PARTICIPANTS_IMPORTS,
  provideBracketConfig,
  SCROLLABLE_IMPORTS,
  SCROLLABLE_NAVIGATION_IMPORTS,
  singleEliminationBracketLayout,
} from '@ethlete/components';
import { normalizeMatch, PARTICIPANTS, SOURCE } from './bracket-participant-focus.data';

@Component({
  selector: 'app-bracket-participant-focus-example',
  template: `
    <et-bracket-participants [(focusedParticipantId)]="focusedParticipantId" [participants]="participants" />

    <et-scrollable [etScrollableButtons]="{ sticky: true }">
      <et-bracket [(focusedParticipantId)]="focusedParticipantId" [source]="source" [columnWidth]="250" />
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BRACKET_IMPORTS, BRACKET_PARTICIPANTS_IMPORTS, SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS],
  providers: [
    provideBracketConfig({
      layouts: [singleEliminationBracketLayout()],
      ...BRACKET_DEFAULT_CARDS,
      matchNormalizer: normalizeMatch,
    }),
  ],
})
export class BracketParticipantFocusExampleComponent {
  public source = SOURCE;
  public participants = PARTICIPANTS;
  protected focusedParticipantId = signal<string | null>(null);
}
