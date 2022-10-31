// import { ET_DUMMY_DATA } from './ET_DUMMY_DATA';
import { ET_DUMMY_DATA } from './ET_DUMMY_DATA_8';
// import { ET_DUMMY_DATA } from './ET_DUMMY_DATA_SINGLE';

const data = structuredClone(ET_DUMMY_DATA) as typeof ET_DUMMY_DATA;
const winnerRounds = data.filter((r) => r.round.bracket === 'winner' || !r.round.bracket);
const loserRounds = data.filter((r) => r.round.bracket === 'looser');

const firstWinnerRound = winnerRounds[0];
const firstLoserRound = loserRounds[0];

const winnerRoundCount = winnerRounds.length;
const loserRoundCount = loserRounds.length;

const bracketSize = firstWinnerRound.matches.length * 2;
const bracketType = loserRoundCount ? 'double' : 'single';

const winnerBracketRowCount = firstWinnerRound.matches.length;
const loserBracketRowCount = firstLoserRound?.matches?.length ?? 0;

const totalRowCount = winnerBracketRowCount + loserBracketRowCount + 1;
const totalColCount =
  bracketType === 'single' ? winnerRoundCount : loserRoundCount + (winnerRoundCount - loserRoundCount / 2) - 1;

const winnerRowStart = 1;
const winnerRowEnd = bracketType === 'single' ? totalRowCount : totalRowCount - winnerBracketRowCount;

const loserRowStart = winnerBracketRowCount + 1;
const loserRowEnd = totalRowCount;

const looserRowAdditionalRoundCount = Math.ceil(Math.log2(Math.log2(bracketSize)));

const transformMatch = (
  match: typeof firstWinnerRound.matches[0],
  matchIndex: number,
  roundRowStart: number,
  matchCount: number,
  firstRoundMatchCount: number,
  previousRound: typeof firstWinnerRound | null,
  nextRound: typeof firstWinnerRound | null,
  currentRound: typeof firstWinnerRound | null,
  currentRoundIndex: number,
) => {
  const diff = firstRoundMatchCount / matchCount;

  const rowStart = roundRowStart + matchIndex * diff;
  const rowEnd = rowStart + diff;

  let roundsSameSize = previousRound?.matches.length === matchCount;

  // For transitioning between last looser bracket round and matching winner bracket round
  const calcNextRound =
    currentRound?.round.bracket === 'looser' && !nextRound
      ? data[currentRoundIndex - looserRowAdditionalRoundCount + 1]
      : nextRound;

  const previousMatchA =
    (roundsSameSize ? previousRound?.matches[matchIndex]?.id : previousRound?.matches[matchIndex * 2]?.id) ?? null;
  let previousMatchB = previousRound?.matches[matchIndex * 2 + 1]?.id ?? null;

  // previousMatchB could be the last loser bracket match
  if (!previousMatchB && currentRound?.round.bracket === 'winner') {
    if (loserRounds.length === currentRoundIndex + looserRowAdditionalRoundCount) {
      previousMatchB = loserRounds[currentRoundIndex + looserRowAdditionalRoundCount - 1].matches[0].id;
      roundsSameSize = false;
    }
  }

  const nextMatch = calcNextRound?.matches[Math.floor(matchIndex / 2)]?.id ?? null;

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
    nextMatch && calcNextRound
      ? {
          roundId: calcNextRound.round.id,
          matchId: nextMatch,
        }
      : null;

  if (match.id === '572b1ac3-c67a-4be1-ad42-0c6ae6f60792loo') {
    console.log({
      match,
      nextRoundMatch,
      previousRoundMatches,
      currentRoundIndex,
    });
  }

  const d: BracketMatch = {
    row: {
      start: rowStart,
      end: rowEnd,
    },
    data: match,

    previousMatches: previousRoundMatches,
    nextMatch: nextRoundMatch,
  };

  return d;
};

export interface BracketMatch {
  row: {
    start: number;
    end: number;
  };
  data: typeof firstWinnerRound.matches[0];
  previousMatches: {
    roundId: string;
    matchIds: string[];
  } | null;

  nextMatch: {
    roundId: string;
    matchId: string;
  } | null;
}

const transformRound = (
  currentRound: typeof firstWinnerRound,
  currentRoundIndex: number,
  previousRound: typeof firstWinnerRound | null,
  nextRound: typeof firstWinnerRound | null,
) => {
  const matchCount = currentRound.matches.length;
  const name = currentRound.round.displayName;
  const isWinnerBracket = currentRound.round.bracket === 'winner' || !currentRound.round.bracket;
  const isDoubleElimination = bracketType === 'double';

  let colStart = 0;
  let colEnd = 0;

  let rowStart = isWinnerBracket ? winnerRowStart : loserRowStart;
  let rowEnd = isWinnerBracket ? winnerRowEnd : loserRowEnd;
  let firstRoundMatchCount = isWinnerBracket ? firstWinnerRound.matches.length : firstLoserRound.matches.length;

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
        if (colEndDouble < loserRoundCount) {
          colStart = colStartDouble;

          // We need to add one to the col to create a actual grid span
          colEnd = colEndDouble + 1;
        } else {
          // If the col end is greater than the total looser rounds, then we need to go back to 1 col wide,
          // since this is the point where semi finals, finals (and second chance final) are played
          const overshoot = colEndDouble - loserRoundCount;
          const delta = Math.floor(overshoot / 2);

          colStart = colStartDouble - delta;
          colEnd = colStartDouble - delta;

          // If the overshoot is bigger than 1, we need to adjust the row start and end to span over the whole grid,
          // since we are in the final round(s).
          // Overshoot 1 means we are in the semi final round and there is a loser bracket round in this step (the last one).
          if (overshoot > 1) {
            rowStart = 1;
            rowEnd = totalRowCount;
            firstRoundMatchCount = totalRowCount - 1;
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
    return transformMatch(
      match,
      matchIndex,
      rowStart,
      matchCount,
      firstRoundMatchCount,
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

export interface EthleteRound {
  id: string;
  displayName: string;
  number: number;
  state: string;
  bracket: 'winner' | 'looser' | null;
}

export interface Bracket {
  participantCount: number;
  totalRows: number;
  totalColumns: number;
  mode: 'single' | 'double';
  dimensions: {
    bracketItem: {
      width: string;
      height: string;
    };
    gap: {
      x: string;
      y: string;
    };
  };
  rounds: BracketRound[];
}

export interface BracketRound {
  matchCount: number;
  name: string;
  matches: BracketMatch[];
  data: EthleteRound;

  row: {
    start: number;
    end: number;
  };

  column: {
    start: number;
    end: number;
  };
}

export const result: Bracket = {
  participantCount: bracketSize,
  mode: bracketType,
  totalRows: totalRowCount,
  totalColumns: totalColCount,

  dimensions: {
    bracketItem: {
      width: '100px',
      height: '41px',
    },
    gap: {
      x: '3rem',
      y: '1rem',
    },
  },

  rounds: [],
};

const indexOfLooserRoundStart = ET_DUMMY_DATA.findIndex((r) => r.round.bracket === 'looser');

for (const [index, round] of data.entries()) {
  let relativeIndex = index;

  if (index === indexOfLooserRoundStart || index > indexOfLooserRoundStart) {
    relativeIndex = index - indexOfLooserRoundStart;
  }

  let previousRound: typeof firstWinnerRound | null = data[index - 1] ?? null;
  const nextRound: typeof firstWinnerRound | null = data[index + 1] ?? null;

  if (previousRound?.round.bracket !== round.round.bracket) {
    previousRound = null;
  }

  result.rounds.push(transformRound(round, relativeIndex, previousRound, nextRound));
}
