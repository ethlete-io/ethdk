import { BracketParticipantsComponent } from './bracket-participants.component';
import { BracketPickCardComponent } from './bracket-pick-card.component';
import { BracketRoundsListComponent } from './bracket-rounds-list.component';
import { BracketComponent } from './bracket.component';

export const BRACKET_IMPORTS = [BracketComponent] as const;

export const BRACKET_ROUNDS_LIST_IMPORTS = [BracketRoundsListComponent] as const;

export const BRACKET_PARTICIPANTS_IMPORTS = [BracketParticipantsComponent] as const;

export const BRACKET_PICK_CARD_IMPORTS = [BracketPickCardComponent] as const;
