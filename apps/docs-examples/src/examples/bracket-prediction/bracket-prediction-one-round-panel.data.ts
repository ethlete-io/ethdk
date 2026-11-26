import { BracketDataSource, bracketSlot, NormalizedMatchParticipant } from '@ethlete/components';

const opening = (id: string, [home, away]: [string, string]) => ({
  id,
  roundId: 'quarter-finals',
  home,
  away,
  winner: null,
  status: 'pending' as const,
  data: null,
});

const fedBy = (id: string, [roundId, homeMatchId, awayMatchId]: [string, string, string]) => ({
  id,
  roundId,
  home: null,
  away: null,
  homeSource: bracketSlot.matchOutcome(homeMatchId, 'winner'),
  awaySource: bracketSlot.matchOutcome(awayMatchId, 'winner'),
  winner: null,
  status: 'pending' as const,
  data: null,
});

export const PANEL_SOURCE: BracketDataSource<null, null> = {
  mode: 'single-elimination',
  rounds: [
    { id: 'quarter-finals', name: 'Quarter-finals', type: 'single-elimination-bracket', data: null },
    { id: 'semi-finals', name: 'Semi-finals', type: 'single-elimination-bracket', data: null },
    { id: 'final', name: 'Final', type: 'final', data: null },
  ],
  matches: [
    opening('qf-1', ['red', 'iron']),
    opening('qf-2', ['gold', 'amber']),
    opening('qf-3', ['green', 'purple']),
    opening('qf-4', ['blue', 'silver']),
    fedBy('semi-1', ['semi-finals', 'qf-1', 'qf-2']),
    fedBy('semi-2', ['semi-finals', 'qf-3', 'qf-4']),
    fedBy('final', ['final', 'semi-1', 'semi-2']),
  ],
};

const participant = ([id, name, code]: [string, string, string], seed: number): NormalizedMatchParticipant => ({
  id,
  name,
  code,
  subtitle: null,
  emblem: null,
  seed,
});

export const PANEL_PARTICIPANTS: Record<string, NormalizedMatchParticipant> = {
  red: participant(['red', 'Red Foxes', 'FOX'], 1),
  gold: participant(['gold', 'Golden Owls', 'OWL'], 2),
  green: participant(['green', 'Green Bears', 'GRN'], 3),
  blue: participant(['blue', 'Blue Whales', 'BLU'], 4),
  silver: participant(['silver', 'Silver Sharks', 'SHK'], 5),
  purple: participant(['purple', 'Purple Panthers', 'PAN'], 6),
  amber: participant(['amber', 'Amber Aces', 'ACE'], 7),
  iron: participant(['iron', 'Iron Ibises', 'IBS'], 8),
};
