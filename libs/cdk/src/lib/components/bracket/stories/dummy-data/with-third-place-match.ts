import { BracketDataSource, COMMON_BRACKET_ROUND_TYPE } from '../../components/new-bracket';

/**
 * Adds a third place round to a single elimination source. Its one match is played by the losers of the
 * round before the final, so the participants come from real semi final results where they exist.
 */
export const withThirdPlaceMatch = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
): BracketDataSource<TRoundData, TMatchData> => {
  const finalIndex = source.rounds.findIndex((round) => round.type === COMMON_BRACKET_ROUND_TYPE.FINAL);
  const finalRound = source.rounds[finalIndex];
  const semiFinalRound = source.rounds[finalIndex - 1];

  if (!finalRound || !semiFinalRound) throw new Error('The source needs a final and a round before it');

  const finalMatch = source.matches.find((match) => match.roundId === finalRound.id);

  if (!finalMatch) throw new Error('The source needs a final match');

  const loserOf = (match: (typeof source.matches)[number] | undefined) => {
    if (!match?.winner) return null;

    return match.winner === 'home' ? match.away : match.home;
  };

  const [firstSemiFinal, secondSemiFinal] = source.matches.filter((match) => match.roundId === semiFinalRound.id);

  return {
    ...source,
    rounds: [
      ...source.rounds,
      {
        ...finalRound,
        id: `${finalRound.id}--third-place`,
        name: 'Third place',
        type: COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE,
      },
    ],
    matches: [
      ...source.matches,
      {
        ...finalMatch,
        id: `${finalMatch.id}--third-place`,
        roundId: `${finalRound.id}--third-place`,
        home: loserOf(firstSemiFinal),
        away: loserOf(secondSemiFinal),
        winner: null,
        status: 'pending',
      },
    ],
  };
};
