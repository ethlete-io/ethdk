import { BracketRound } from '../../linked';
import { CreateBracketGridConfig } from './types';

export const resolveBracketGridRowSpan = <TRoundData, TMatchData>(
  bracket: { rounds: { values(): Iterable<BracketRound<TRoundData, TMatchData>> } },
  options: CreateBracketGridConfig,
) => {
  if (!options.rowSpanRoundId) return options;

  const round = Array.from(bracket.rounds.values()).find(
    (candidate) =>
      candidate.id === options.rowSpanRoundId || candidate.id.startsWith(`${options.rowSpanRoundId}--half-`),
  );

  return round ? { ...options, rowSpanMatchCount: round.matchCount } : options;
};
