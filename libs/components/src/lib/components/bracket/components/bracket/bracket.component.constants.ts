import { ET_DUMMY_DATA } from './ET_DUMMY_DATA';
import { FIFA_DUMMY_DATA } from './FIFA_DUMMY_DATA_DE';

const genMatchDay = (size: number) => {
  const genMatch = (id: number) => ({
    id,
    home: `${size}: Home-${id}`,
    away: `${size}: Away-${id}`,
    bracket: size === 1 ? null : id - 1 < size / 2 ? 'winner' : 'looser',
  });

  return Array.from({ length: size }, (_, i) => genMatch(i + 1));
};

export const DUMMY_BRACKET_DATA = [
  {
    id: 1,
    name: 'Round of 64',
    matches: genMatchDay(64),
  },
  {
    id: 2,
    name: 'Round of 32',
    matches: genMatchDay(32),
  },
  {
    id: 3,
    name: 'Round of 16',
    matches: genMatchDay(16),
  },
  {
    id: 4,
    name: 'Quarterfinals',
    matches: genMatchDay(8),
  },
  {
    id: 5,
    name: 'Semifinals',
    matches: genMatchDay(4),
  },
  {
    id: 6,
    name: 'Finals',
    matches: genMatchDay(1),
  },
];

// console.log(DUMMY_BRACKET_DATA);

// console.log(
//   FIFA_DUMMY_DATA.matches
//     .filter((m) => m.stageNumber === 1)
//     .map((m) => {
//       const homeName = m.homeMatchSide.participant?.participation.team.name;
//       const awayName = m.awayMatchSide.participant?.participation.team.name;

//       return {
//         homeName,
//         awayName,
//         roundNumber: m.roundNumber,
//         stageNumber: m.stageNumber,
//         bracketType: m.bracketType,
//         data: m,
//       };
//     }),
// );

// stageNumber 1/2/3
// roundNumber always starts with 1 when stageNumber changes

const sortedMatched = [...FIFA_DUMMY_DATA.matches].sort((a, b) => {
  if (a.stageNumber === b.stageNumber) {
    return a.roundNumber - b.roundNumber;
  }

  return a.stageNumber - b.stageNumber;
});
const isDoubleElimination = FIFA_DUMMY_DATA.matches.some((m) => m.bracketType === 'looser');

// console.log(sortedMatched.map((m) => `${m.stageNumber}/${m.roundNumber}`));

const result: Record<
  number,
  {
    matches: any[];
  }
> = {};

for (const match of sortedMatched) {
  const { stageNumber, roundNumber } = match;

  if (!result[stageNumber]) {
    result[stageNumber] = {
      matches: [],
    };
  }

  result[stageNumber].matches.push(match);
}

type ParticipantCount = 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256 | 512;

const calcBracketRowsSingleElimination = (participantCount: ParticipantCount) => {
  const rowCount = Math.log2(participantCount);

  const result: Record<
    number,
    {
      title: string;
    }
  > = {};

  for (let i = 0; i < rowCount; i++) {
    const remainingParticipants = participantCount / 2 ** i;

    const roundName = `Round of ${remainingParticipants}`;
    const customRoundName =
      i === rowCount - 1 ? 'Finals' : i === rowCount - 2 ? 'Semifinals' : i === rowCount - 3 ? 'Quarterfinals' : null;

    result[i + 1] = {
      title: customRoundName ?? roundName,
    };
  }

  return result;
};

// console.log(calcBracketRowsSingleElimination(16));
// console.log(calcBracketRowsSingleElimination(512));

const calcBracketRowsDoubleElimination = (participantCount: ParticipantCount) => {
  const log2 = Math.log2(participantCount);
  const winnerRowCount = log2 + 1;
  const looserRowCount = Math.ceil(log2) + Math.ceil(Math.log2(log2));

  const resultWinners: Record<
    number,
    {
      title: string;
    }
  > = {};

  for (let i = 0; i < winnerRowCount; i++) {
    const remainingParticipants = participantCount / 2 ** i;

    const roundName = `Round of ${remainingParticipants}`;
    const customRoundName =
      i === winnerRowCount - 1
        ? 'Finals'
        : i === winnerRowCount - 2
        ? 'Semifinals'
        : i === winnerRowCount - 3
        ? 'Quarterfinals'
        : null;

    resultWinners[i + 1] = {
      title: customRoundName ?? roundName,
    };
  }

  const resultLoosers: Record<
    number,
    {
      title: string;
    }
  > = {};

  for (let i = 0; i < looserRowCount; i++) {
    const roundName = `Looser round ${i + 1}`;

    resultLoosers[i + 1] = {
      title: roundName,
    };
  }

  return { resultWinners, resultLoosers };
};

// console.log(calcBracketRowsDoubleElimination(32));
// console.log(calcBracketRowsDoubleElimination(64));

const participants = ET_DUMMY_DATA[0].matches.length * 2;

// console.log(participants);

const brackets = calcBracketRowsDoubleElimination(participants as any);

// console.log(brackets);

let matchIndex = 0;
export const winnerBracketRows = Object.entries(brackets.resultWinners).map(([key, value]) => ({
  id: key,
  name: value.title,
  matches: ET_DUMMY_DATA.filter((m) => m.round.bracket === 'winner')[matchIndex++]?.matches ?? [],
}));

matchIndex = 0;
export const loserBracketRows = Object.entries(brackets.resultLoosers).map(([key, value]) => ({
  id: key,
  name: value.title,
  matches: ET_DUMMY_DATA.filter((m) => m.round.bracket === 'looser')[matchIndex++]?.matches ?? [],
}));

// console.log({ winnerBracketRows, loserBracketRows });
