import { MatchParticipantComponent } from './match-participant.component';

/**
 * The participant display primitive (`<et-match-participant>`) — emblem, name and optional seed for
 * one side of a match. Standalone as well as inside a card: a roster, a standings cell, a filter chip.
 * Pulls in [`et-picture`](/components/picture) and the skeleton.
 */
export const MATCH_PARTICIPANT_IMPORTS = [MatchParticipantComponent] as const;
