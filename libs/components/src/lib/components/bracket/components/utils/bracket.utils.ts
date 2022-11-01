import { MatchListView } from '@ethlete/types';
import { BracketMatch, BracketRound, EthleteRound, RoundWithMatchesView } from '../../components';

let bracketId = 0;

export class Bracket {
  get winnerRounds() {
    return this._roundsWithMatches.filter((r) => r.round.bracket === 'winner' || !r.round.bracket);
  }

  get loserRounds() {
    return this._roundsWithMatches.filter((r) => r.round.bracket === 'looser');
  }

  get firstWinnerRound() {
    return this.winnerRounds[0];
  }

  get firstLoserRound() {
    return (this.loserRounds[0] ?? null) as RoundWithMatchesView | null;
  }

  get winnerRoundCount() {
    return this.winnerRounds.length;
  }

  get loserRoundCount() {
    return this.loserRounds.length;
  }

  get bracketSize() {
    return this.firstWinnerRound.matches.length * 2;
  }

  get bracketType() {
    return !this.loserRoundCount ? 'single' : 'double';
  }

  get winnerBracketRowCount() {
    return this.firstWinnerRound.matches.length;
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
    return this._roundsWithMatches.findIndex((r) => r.round.bracket === 'looser');
  }

  readonly looserRowAdditionalRoundCount;
  readonly bracketRounds: BracketRound[];
  readonly id = bracketId++;

  constructor(private _roundsWithMatches: RoundWithMatchesView[]) {
    this.looserRowAdditionalRoundCount = Math.ceil(Math.log2(Math.log2(this.bracketSize)));
    this.bracketRounds = this._computeBracket(_roundsWithMatches);
  }

  private _computeBracket(data: RoundWithMatchesView[]) {
    const rounds: BracketRound[] = [];

    for (const [index, round] of data.entries()) {
      let relativeIndex = index;

      if (index === this.indexOfLooserRoundStart || index > this.indexOfLooserRoundStart) {
        relativeIndex = index - this.indexOfLooserRoundStart;
      }

      let previousRound: RoundWithMatchesView | null = data[index - 1] ?? null;
      const nextRound: RoundWithMatchesView | null = data[index + 1] ?? null;

      if (previousRound?.round.bracket !== round.round.bracket) {
        previousRound = null;
      }

      rounds.push(this._transformRound(round, relativeIndex, previousRound, nextRound));
    }

    return rounds;
  }

  private _transformRound = (
    currentRound: RoundWithMatchesView,
    currentRoundIndex: number,
    previousRound: RoundWithMatchesView | null,
    nextRound: RoundWithMatchesView | null,
  ) => {
    const matchCount = currentRound.matches.length;
    const name = currentRound.round.displayName;
    const isWinnerBracket = currentRound.round.bracket === 'winner' || !currentRound.round.bracket;
    const isDoubleElimination = this.bracketType === 'double';

    let colStart = 0;
    let colEnd = 0;

    let rowStart = isWinnerBracket ? this.winnerRowStart : this.loserRowStart;
    let rowEnd = isWinnerBracket ? this.winnerRowEnd : this.loserRowEnd;
    let firstRoundMatchCount = isWinnerBracket
      ? this.firstWinnerRound.matches.length
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

          // If the col end is greater than the total looser rounds, then we need to span 2 cols,
          // since the loser bracket will always play 2 rounds per winner bracket round.
          if (colEndDouble < this.loserRoundCount) {
            colStart = colStartDouble;

            // We need to add one to the col to create a actual grid span
            colEnd = colEndDouble + 1;
          } else {
            // If the col end is greater than the total looser rounds, then we need to go back to 1 col wide,
            // since this is the point where semi finals, finals (and second chance final) are played
            const overshoot = colEndDouble - this.loserRoundCount;
            const delta = Math.floor(overshoot / 2);

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
      } else {
        // Loser bracket rounds are always 1 col wide.
        colStart = currentRoundIndex + 1;
        colEnd = currentRoundIndex + 1;
      }
    } else {
      // Single elimination brackets are always 1 col wide.
      colStart = currentRoundIndex;
      colEnd = currentRoundIndex;
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

    const r: BracketRound = {
      matchCount,
      name,
      matches,
      data: currentRound.round as EthleteRound,

      row: {
        start: rowStart,
        end: rowEnd,
      },
      column: {
        start: colStart,
        end: colEnd,
      },
    };

    return r;
  };

  private _transformMatch = (
    match: MatchListView,
    matchIndex: number,
    roundRowStart: number,
    matchCount: number,
    firstRoundMatchCount: number,
    previousRound: RoundWithMatchesView | null,
    nextRound: RoundWithMatchesView | null,
    currentRound: RoundWithMatchesView | null,
    currentRoundIndex: number,
  ) => {
    const diff = firstRoundMatchCount / matchCount;

    const rowStart = roundRowStart + matchIndex * diff;
    const rowEnd = rowStart + diff;

    let roundsSameSize = previousRound?.matches.length === matchCount;

    let logicalNextRound: RoundWithMatchesView | null = null;

    if (currentRound?.round.bracket === 'looser' && !nextRound) {
      // Transition from last round of looser bracket to semi final round of winner bracket
      logicalNextRound = this._roundsWithMatches[currentRoundIndex - this.looserRowAdditionalRoundCount + 1];
    } else if (
      (currentRound?.round.bracket === 'winner' || !currentRound?.round.bracket) &&
      nextRound?.round.bracket === 'looser'
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
    if (!previousMatchB && currentRound?.round.bracket === 'winner') {
      if (this.loserRounds.length === currentRoundIndex + this.looserRowAdditionalRoundCount) {
        previousMatchB = this.loserRounds[currentRoundIndex + this.looserRowAdditionalRoundCount - 1].matches[0].id;
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

    const d: BracketMatch = {
      row: {
        start: rowStart,
        end: rowEnd,
      },
      data: match as any as MatchListView,

      previousMatches: previousRoundMatches,
      nextMatch: nextRoundMatch,
    };

    return d;
  };
}
