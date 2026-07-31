import {
  MatchCardDirective,
  MatchCardGameScoresDirective,
  MatchCardMetaDirective,
  MatchCardScoreDirective,
} from './headless';
import { MatchCardComponent } from './match-card.component';
import { MatchParticipantComponent } from './match-participant.component';

/**
 * The participant display primitive (`<et-match-participant>`) — emblem, name and optional seed for one
 * side of a match. Standalone as well as inside a card: a roster, a standings cell, a filter chip.
 * Pulls in [`et-picture`](/components/picture) and the skeleton.
 */
export const MATCH_PARTICIPANT_IMPORTS = [MatchParticipantComponent] as const;

/**
 * The match card (`<et-match-card>` / `<a et-match-card>`), the participant primitive it draws, and the
 * headless directive plus parts to build a card of your own.
 */
export const MATCH_CARD_IMPORTS = [
  MatchCardComponent,
  MatchParticipantComponent,
  MatchCardDirective,
  MatchCardMetaDirective,
  MatchCardScoreDirective,
  MatchCardGameScoresDirective,
] as const;
