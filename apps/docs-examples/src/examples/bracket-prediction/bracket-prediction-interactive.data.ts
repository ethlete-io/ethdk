import { BracketDataSource, bracketSlot, NormalizedMatchParticipant } from '@ethlete/components';

export const PREDICTION_SOURCE: BracketDataSource<null, null> = {
  mode: 'single-elimination',
  rounds: [
    { id: 'quarter-finals', name: 'Quarter-finals', type: 'single-elimination-bracket', data: null },
    { id: 'semi-finals', name: 'Semi-finals', type: 'single-elimination-bracket', data: null },
    { id: 'final', name: 'Final', type: 'final', data: null },
  ],
  matches: [
    { id: 'qf-1', roundId: 'quarter-finals', home: 'red', away: 'iron', winner: null, status: 'pending', data: null },
    { id: 'qf-2', roundId: 'quarter-finals', home: 'gold', away: 'amber', winner: null, status: 'pending', data: null },
    {
      id: 'qf-3',
      roundId: 'quarter-finals',
      home: 'green',
      away: 'purple',
      winner: null,
      status: 'pending',
      data: null,
    },
    {
      id: 'qf-4',
      roundId: 'quarter-finals',
      home: 'blue',
      away: 'silver',
      winner: null,
      status: 'pending',
      data: null,
    },
    {
      id: 'semi-1',
      roundId: 'semi-finals',
      home: null,
      away: null,
      homeSource: bracketSlot.matchOutcome('qf-1', 'winner'),
      awaySource: bracketSlot.matchOutcome('qf-2', 'winner'),
      winner: null,
      status: 'pending',
      data: null,
    },
    {
      id: 'semi-2',
      roundId: 'semi-finals',
      home: null,
      away: null,
      homeSource: bracketSlot.matchOutcome('qf-3', 'winner'),
      awaySource: bracketSlot.matchOutcome('qf-4', 'winner'),
      winner: null,
      status: 'pending',
      data: null,
    },
    {
      id: 'final',
      roundId: 'final',
      home: null,
      away: null,
      homeSource: bracketSlot.matchOutcome('semi-1', 'winner'),
      awaySource: bracketSlot.matchOutcome('semi-2', 'winner'),
      winner: null,
      status: 'pending',
      data: null,
    },
  ],
};

const RED: NormalizedMatchParticipant = {
  id: 'red',
  name: 'Red Foxes',
  code: 'FOX',
  subtitle: null,
  emblem: null,
  seed: 1,
};
const BLUE: NormalizedMatchParticipant = {
  id: 'blue',
  name: 'Blue Whales',
  code: 'BLU',
  subtitle: null,
  emblem: null,
  seed: 4,
};
const GOLD: NormalizedMatchParticipant = {
  id: 'gold',
  name: 'Golden Owls',
  code: 'OWL',
  subtitle: null,
  emblem: null,
  seed: 2,
};
const GREEN: NormalizedMatchParticipant = {
  id: 'green',
  name: 'Green Bears',
  code: 'GRN',
  subtitle: null,
  emblem: null,
  seed: 3,
};
const SILVER: NormalizedMatchParticipant = {
  id: 'silver',
  name: 'Silver Sharks',
  code: 'SHK',
  subtitle: null,
  emblem: null,
  seed: 5,
};
const PURPLE: NormalizedMatchParticipant = {
  id: 'purple',
  name: 'Purple Panthers',
  code: 'PAN',
  subtitle: null,
  emblem: null,
  seed: 6,
};
const AMBER: NormalizedMatchParticipant = {
  id: 'amber',
  name: 'Amber Aces',
  code: 'ACE',
  subtitle: null,
  emblem: null,
  seed: 7,
};
const IRON: NormalizedMatchParticipant = {
  id: 'iron',
  name: 'Iron Ibises',
  code: 'IBS',
  subtitle: null,
  emblem: null,
  seed: 8,
};

export const PARTICIPANTS: Record<string, NormalizedMatchParticipant> = {
  red: RED,
  blue: BLUE,
  gold: GOLD,
  green: GREEN,
  silver: SILVER,
  purple: PURPLE,
  amber: AMBER,
  iron: IRON,
};
