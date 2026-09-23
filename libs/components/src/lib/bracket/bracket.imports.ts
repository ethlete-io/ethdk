import { BracketParticipantsComponent } from './bracket-participants.component';
import { BracketPickCardComponent } from './bracket-pick-card.component';
import { BracketRoundsListComponent } from './bracket-rounds-list.component';
import { BracketComponent } from './bracket.component';

export const BRACKET_IMPORTS = [
  BracketComponent,
  BracketParticipantsComponent,
  BracketPickCardComponent,
  BracketRoundsListComponent,
] as const;
