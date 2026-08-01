import { MatchLabels } from './match-labels';
import { NormalizedMatchParticipant } from './match.types';

export type MatchParticipantDisplayNameOptions = {
  /** The side to name. `null` is a TBD slot, which is named by the `tbd` label. */
  participant: NormalizedMatchParticipant | null;
  /** The label set in effect - supplies `tbd` when there is nothing else to say. */
  labels: MatchLabels;
  /** Prefer the short `code` over the full name, for a narrow column. @default false */
  compact?: boolean;
};

/**
 * What one side of a match is called, in one string. Extracted so the fallback chain exists once: the
 * participant primitive renders it, and a match card composes its accessible name from it without
 * reaching into the rendered participants.
 *
 * Compact prefers the code and falls back to the name, because a participant with no code still has to
 * be readable in a narrow column. Non-compact does the reverse - a name is what a participant is
 * called, and the code is what's left when the API hasn't sent one.
 */
export const matchParticipantDisplayName = ({ participant, labels, compact }: MatchParticipantDisplayNameOptions) => {
  if (!participant) return labels.tbd;

  const name = compact ? (participant.code ?? participant.name) : (participant.name ?? participant.code);

  return name ?? labels.tbd;
};
