import { MatchListView, RoundStageStructureWithMatchesView } from '@ethlete/types';
import { BracketMatch, BracketRound } from '../types';

let bracketId = 0;

export const isUpperBracketMatch = (match: RoundStageStructureWithMatchesView | null | undefined) => {
  if (!match) {
    return false;
  }

  return (
    match.round.type === 'winner_bracket' ||
    match.round.type === 'final' ||
    match.round.type === 'normal' ||
    match.round.type === 'reverse_final' ||
    !match.round.type
  );
};

export const orderRounds = (rounds: RoundStageStructureWithMatchesView[]) => {
  const normalRounds = orderRoundsByRoundNumber(rounds.filter((r) => r.round.type === 'normal'));
  const winnerRounds = orderRoundsByRoundNumber(rounds.filter((r) => r.round.type === 'winner_bracket'));
  const loserRounds = orderRoundsByRoundNumber(rounds.filter((r) => r.round.type === 'loser_bracket'));
  const finalRounds = rounds.filter((r) => r.round.type === 'final');
  const reverseFinalRounds = rounds.filter((r) => r.round.type === 'reverse_final');
  const thirdPlaceRounds = rounds.filter((r) => r.round.type === 'third_place');

  return [...winnerRounds, ...normalRounds, ...finalRounds, ...reverseFinalRounds, ...loserRounds, ...thirdPlaceRounds];
};

export const orderRoundsByRoundNumber = (rounds: RoundStageStructureWithMatchesView[]) => {
  return rounds.slice(0).sort((a, b) => {
    if (a.round.number < b.round.number) {
      return -1;
    }
    if (a.round.number > b.round.number) {
      return 1;
    }
    return 0;
  });
};

export const normalizeRoundType = (roundType: string | null | undefined) => {
  if (!roundType) {
    return null;
  }

  if (
    roundType === 'normal' ||
    roundType === 'winner_bracket' ||
    roundType === 'final' ||
    roundType === 'reverse_final'
  ) {
    return 'upper';
  }

  return 'lower';
};

export class Bracket {
  get winnerRounds() {
    return this._roundsWithMatches.filter((r) => isUpperBracketMatch(r));
  }

  get loserRounds() {
    return this._roundsWithMatches.filter((r) => r.round.type === 'loser_bracket');
  }

  get firstWinnerRound() {
    return this.winnerRounds[0] ?? null;
  }

  get firstLoserRound() {
    return this.loserRounds[0] ?? null;
  }

  get winnerRoundCount() {
    return this.winnerRounds.length;
  }

  get loserRoundCount() {
    return this.loserRounds.length;
  }

  get bracketSize() {
    return this.firstWinnerRound ? this.firstWinnerRound.matches.length * 2 : 0;
  }

  get bracketType() {
    return !this.loserRoundCount ? 'single' : 'double';
  }

  get winnerBracketRowCount() {
    return this.firstWinnerRound?.matches.length ?? 0;
  }

  get loserBracketRowCount() {
    return this.firstLoserRound?.matches.length ?? 0;
  }

  get totalRowCount() {
    return this.winnerBracketRowCount + this.loserBracketRowCount + 1;
  }

  get totalColCount() {
    return this.bracketType === 'single'
      ? this.winnerRoundCount
      : this.loserRoundCount + (this.winnerRoundCount - this.loserRoundCount / 2) - 1;
  }

  get winnerRowStart() {
    return 1;
  }

  get winnerRowEnd() {
    return this.bracketType === 'single' ? this.totalRowCount : this.totalRowCount - this.winnerBracketRowCount;
  }

  get loserRowStart() {
    return this.winnerBracketRowCount + 1;
  }

  get loserRowEnd() {
    return this.totalRowCount;
  }

  get indexOfLooserRoundStart() {
    return this._roundsWithMatches.findIndex((r) => r.round.type === 'loser_bracket');
  }

  get looserRowAdditionalRoundCount() {
    if (this.bracketType === 'single') {
      return 0;
    }

    const winnerRounds = this._roundsWithMatches.filter((r) => r.round.type === 'winner_bracket');
    const winnerRoundCount = winnerRounds.length;
    const loserRounds = this._roundsWithMatches.filter((r) => r.round.type === 'loser_bracket');
    const loserRoundCount = loserRounds.length;

    return loserRoundCount - winnerRoundCount;
  }

  get isPartialDoubleElimination() {
    return (
      this.bracketType === 'double' && this.firstWinnerRound?.matches.length === this.firstLoserRound?.matches.length
    );
  }

  readonly bracketRounds: BracketRound[];
  readonly id = bracketId++;

  private readonly _bracketMatches: BracketMatch[];

  constructor(private _roundsWithMatches: RoundStageStructureWithMatchesView[]) {
    this.bracketRounds = this._computeBracket(_roundsWithMatches);

    const rounds = this.bracketRounds.map((r) => r.matches);
    const flatMatches: BracketMatch[] = [];

    for (const round of rounds) {
      for (const match of round) {
        flatMatches.push(match);
      }
    }

    this._bracketMatches = flatMatches;
  }

  getRoundById(roundId: string) {
    return this.bracketRounds.find((r) => r.data.id === roundId);
  }

  getMatchById(matchId: string) {
    return this._bracketMatches.find((m) => m.data.id === matchId);
  }

  private _computeBracket(data: RoundStageStructureWithMatchesView[]) {
    const rounds: BracketRound[] = [];

    for (const [index, round] of data.entries()) {
      let relativeIndex = index;

      if (index === this.indexOfLooserRoundStart || index > this.indexOfLooserRoundStart) {
        relativeIndex = index - this.indexOfLooserRoundStart;
      }

      let previousRound: RoundStageStructureWithMatchesView | null = data[index - 1] ?? null;
      const nextRound: RoundStageStructureWithMatchesView | null = data[index + 1] ?? null;

      // Switching to loser bracket should reset the previousRound.
      if (normalizeRoundType(previousRound?.round.type) !== normalizeRoundType(round.round.type)) {
        previousRound = null;
      }

      rounds.push(this._transformRound(round, relativeIndex, previousRound, nextRound));
    }

    return rounds;
  }

  private _transformRound = (
    currentRound: RoundStageStructureWithMatchesView,
    currentRoundIndex: number,
    previousRound: RoundStageStructureWithMatchesView | null,
    nextRound: RoundStageStructureWithMatchesView | null,
  ): BracketRound => {
    const matchCount = currentRound.matches.length;
    const name = currentRound.round.name;
    const isWinnerBracket = isUpperBracketMatch(currentRound);
    const isDoubleElimination = this.bracketType === 'double';

    let colStart = 0;
    let colEnd = 0;

    let rowStart = isWinnerBracket ? this.winnerRowStart : this.loserRowStart;
    let rowEnd = isWinnerBracket ? this.winnerRowEnd : this.loserRowEnd;
    let firstRoundMatchCount = isWinnerBracket
      ? this.firstWinnerRound?.matches.length
      : this.firstLoserRound?.matches.length;

    if (isDoubleElimination) {
      if (isWinnerBracket) {
        if (currentRoundIndex === 0) {
          // The first winner bracket round is always 1 col wide.
          colStart = 1;
          colEnd = 1;
        } else {
          const colStartDouble = currentRoundIndex * 2;
          const colEndDouble = colStartDouble + 1;
          const isSemiFinalRound = currentRound.round.type === 'winner_bracket' && matchCount === 1;

          // If the col end is greater than the total looser rounds, then we need to span 2 cols,
          // since the loser bracket will always play 2 rounds per winner bracket round.
          // We also need to span 2 col if the current round is the semi final round AND we have an async start.
          // Async start means that the first winner round's matches length is equal to the first loser round's matches length.
          // This is produced by only showing a part (eg. the last 5 rounds) of a much bigger bracket.
          if (colEndDouble < this.loserRoundCount || (isSemiFinalRound && this.isPartialDoubleElimination)) {
            colStart = colStartDouble;

            // We need to add one to the col to create a actual grid span
            colEnd = colEndDouble + 1;
          } else {
            // If the col end is greater than the total looser rounds, then we need to go back to 1 col wide,
            // since this is the point where semi finals, finals (and second chance final) are played
            const overshoot = colEndDouble - this.loserRoundCount;
            let delta = Math.floor(overshoot / 2);

            if (this.isPartialDoubleElimination) {
              delta = delta - 1;
            }

            colStart = colStartDouble - delta;
            colEnd = colStartDouble - delta;

            // If the overshoot is bigger than 1, we need to adjust the row start and end to span over the whole grid,
            // since we are in the final round(s).
            // Overshoot 1 means we are in the semi final round and there is a loser bracket round in this step (the last one).
            if (overshoot > 1) {
              rowStart = 1;
              rowEnd = this.totalRowCount;
              firstRoundMatchCount = this.totalRowCount - 1;
            }
          }
        }
      } else if (currentRound.round.type === 'third_place') {
        const hasSecondChanceFinal = this._roundsWithMatches.some((r) => r.round.type === 'reverse_final');

        // Span the third place match form final to second chance final
        if (hasSecondChanceFinal) {
          colStart = currentRoundIndex + 1;
          colEnd = currentRoundIndex + 3;
        } else {
          // Keep the third place match in the same col as the final
          colStart = currentRoundIndex + 1;
          colEnd = currentRoundIndex + 1;
        }
      } else {
        // Loser bracket rounds are always 1 col wide.
        colStart = currentRoundIndex + 1;
        colEnd = currentRoundIndex + 1;
      }
    } else {
      if (currentRound.round.type === 'third_place') {
        // The third place match is always in the same col as the final
        colStart = currentRoundIndex - 1;
        colEnd = currentRoundIndex - 1;

        if (this.winnerRowEnd - 1 === 2) {
          // Special case for 2 match brackets
          rowStart = 2;
          rowEnd = 2;
        } else if (this.winnerRowEnd - 1 === 4) {
          // Special case for 4 match brackets
          rowStart = 3;
          rowEnd = 3;
        } else if (this.winnerRowEnd - 1 > 4) {
          // Special case for 8+ match brackets. This will result in it being in the same row as the second semi final match.
          rowStart = (this.winnerRowEnd - 1) / 2 + (this.winnerRowEnd - 1) / 2 / 2;
          rowEnd = this.winnerRowEnd;
        }
      } else {
        // All other single elimination rounds are always 1 col wide.
        colStart = currentRoundIndex;
        colEnd = currentRoundIndex;
      }
    }

    const matches = currentRound.matches.map((match, matchIndex) => {
      return this._transformMatch(
        match,
        matchIndex,
        rowStart,
        matchCount,
        firstRoundMatchCount ?? 0,
        previousRound,
        nextRound,
        currentRound,
        currentRoundIndex,
      );
    });

    return {
      matchCount,
      name,
      matches,
      data: currentRound.round,

      row: {
        start: rowStart,
        end: rowEnd,
      },
      column: {
        start: colStart,
        end: colEnd,
      },
    };
  };

  private _transformMatch = (
    match: MatchListView,
    matchIndex: number,
    roundRowStart: number,
    matchCount: number,
    firstRoundMatchCount: number,
    previousRound: RoundStageStructureWithMatchesView | null,
    nextRound: RoundStageStructureWithMatchesView | null,
    currentRound: RoundStageStructureWithMatchesView | null,
    currentRoundIndex: number,
  ): BracketMatch => {
    const diff = firstRoundMatchCount / matchCount;

    let rowStart = roundRowStart + matchIndex * diff;
    let rowEnd = rowStart + diff;

    if (currentRound?.round.type === 'third_place' && this.bracketType === 'single') {
      // Special case for 8+ single elimination brackets. This will result in the current match being in the same row as the second semi final match.
      if (this.winnerRowEnd - 1 > 4) {
        rowStart = (this.winnerRowEnd - 1) / 2;
        rowEnd = this.winnerRowEnd - 1;
      }
    }

    let roundsSameSize = previousRound?.matches.length === matchCount;
    let logicalNextRound: RoundStageStructureWithMatchesView | null = null;

    if (
      (currentRound?.round.type === 'loser_bracket' && !nextRound) ||
      (currentRound?.round.type === 'loser_bracket' && nextRound?.round.type === 'third_place')
    ) {
      const next = this._roundsWithMatches[currentRoundIndex - this.looserRowAdditionalRoundCount + 1];

      if (next) {
        // Transition from last round of looser bracket to semi final round of winner bracket
        logicalNextRound = next;
      }
    } else if (
      ((currentRound && isUpperBracketMatch(currentRound)) || !currentRound?.round.type) &&
      nextRound?.round.type === 'loser_bracket'
    ) {
      // The last winner round (final) does not have a next round, but the next round is the first looser round.
      logicalNextRound = null;
    } else {
      logicalNextRound = nextRound;
    }

    const previousMatchA =
      (roundsSameSize ? previousRound?.matches[matchIndex]?.id : previousRound?.matches[matchIndex * 2]?.id) ?? null;
    let previousMatchB = previousRound?.matches[matchIndex * 2 + 1]?.id ?? null;

    // previousMatchB could be the last loser bracket match
    if (!previousMatchB && currentRound && isUpperBracketMatch(currentRound)) {
      const matchB = this.loserRounds[currentRoundIndex + this.looserRowAdditionalRoundCount - 1]?.matches[0];

      if (this.loserRounds.length === currentRoundIndex + this.looserRowAdditionalRoundCount && matchB) {
        previousMatchB = matchB.id;
        roundsSameSize = false;
      }
    }

    const nextMatch = logicalNextRound?.matches[Math.floor(matchIndex / 2)]?.id ?? null;

    let previousRoundMatches = null;

    if (previousRound) {
      if (roundsSameSize && previousMatchA) {
        // 1 match to 1 match
        previousRoundMatches = {
          roundId: previousRound.round.id,
          matchIds: [previousMatchA],
        };
      } else if (previousMatchA && previousMatchB) {
        // 2 matches to 1 match
        previousRoundMatches = {
          roundId: previousRound.round.id,
          matchIds: [previousMatchA, previousMatchB],
        };
      }
    }

    const nextRoundMatch =
      nextMatch && logicalNextRound
        ? {
            roundId: logicalNextRound.round.id,
            matchId: nextMatch,
          }
        : null;

    return {
      row: {
        start: rowStart,
        end: rowEnd,
      },
      data: match,

      previousMatches: currentRound?.round.type !== 'third_place' ? previousRoundMatches : null,
      nextMatch: currentRound?.round.type !== 'third_place' ? nextRoundMatch : null,
    };
  };
}
