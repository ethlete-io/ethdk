// import { ET_DUMMY_DATA } from './ET_DUMMY_DATA';
import { ET_DUMMY_DATA } from './ET_DUMMY_DATA_SINGLE';

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

const exampleResult = {
  participantCount: bracketSize,
  mode: bracketType,
  rounds: [
    {
      matches: [
        {
          connections: {
            previous: {
              type: 'straight',
            },
            next: {
              type: 'straight',
            },
          },

          data: {},
        },
      ],
      matchCount: 0,
      name: 'Round name',
      row: {
        start: 0,
        end: 0,
      },
      column: {
        start: 0,
        end: 0,
      },
    },
  ],
};

const transformMatch = (
  match: typeof firstWinnerRound.matches[0],
  matchIndex: number,
  roundRowStart: number,
  matchCount: number,
  firstRoundMatchCount: number,
) => {
  const diff = firstRoundMatchCount / matchCount;

  const rowStart = roundRowStart + matchIndex * diff;
  const rowEnd = rowStart + diff;

  return {
    row: {
      start: rowStart,
      end: rowEnd,
    },
    data: match,
  };
};

const transformRound = (round: typeof firstWinnerRound, roundIndex: number) => {
  const matchCount = round.matches.length;
  const name = round.round.displayName;
  const isWinnerBracket = round.round.bracket === 'winner' || !round.round.bracket;
  const isDoubleElimination = bracketType === 'double';

  let colStart = 0;
  let colEnd = 0;

  let rowStart = isWinnerBracket ? winnerRowStart : loserRowStart;
  let rowEnd = isWinnerBracket ? winnerRowEnd : loserRowEnd;
  let firstRoundMatchCount = isWinnerBracket ? firstWinnerRound.matches.length : firstLoserRound.matches.length;

  if (isDoubleElimination) {
    if (isWinnerBracket) {
      if (roundIndex === 0) {
        // The first winner bracket round is always 1 col wide.
        colStart = 1;
        colEnd = 1;
      } else {
        const colStartDouble = roundIndex * 2;
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
      colStart = roundIndex + 1;
      colEnd = roundIndex + 1;
    }
  } else {
    // Single elimination brackets are always 1 col wide.
    colStart = roundIndex + 1;
    colEnd = roundIndex + 1;
  }

  const matches = round.matches.map((match, matchIndex) =>
    transformMatch(match, matchIndex, rowStart, matchCount, firstRoundMatchCount),
  );

  return {
    matchCount,
    name,
    matches,

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

export const result: {
  participantCount: number;
  totalRows: number;
  totalColumns: number;
  mode: 'single' | 'double';
  rounds: any[];
} = {
  participantCount: bracketSize,
  mode: bracketType,
  totalRows: totalRowCount,
  totalColumns: totalColCount,
  rounds: [],
};

for (const [index, round] of data.entries()) {
  const indexTransformed = round.round.bracket === 'winner' ? index : index - winnerRoundCount;

  result.rounds.push(transformRound(round, indexTransformed));
}

console.log(result);
