import { BracketNew } from '@ethlete/cdk';

export type Team = { name: string };

export const TEAMS: Record<string, Team> = {
  u1: { name: 'FC Berlin' },
  u2: { name: 'Neon Esports' },
  u3: { name: 'Rote Löwen' },
  u4: { name: 'Hafen United' },
  u5: { name: 'Delay Sports' },
  u6: { name: 'Nordost Kickers' },
  u7: { name: 'Spree Rangers' },
  u8: { name: 'Alpen Wölfe' },
};

export const DOUBLE_ELIMINATION_SOURCE: BracketNew.BracketDataSource<null, null> = {
  mode: 'double-elimination',
  rounds: [
    { id: 'ub-r0', type: 'upper-bracket', name: 'Winners round 1', data: null },
    { id: 'ub-r1', type: 'upper-bracket', name: 'Winners round 2', data: null },
    { id: 'ub-r2', type: 'upper-bracket', name: 'Winners round 3', data: null },
    { id: 'lb-r0', type: 'lower-bracket', name: 'Losers round 1', data: null },
    { id: 'lb-r1', type: 'lower-bracket', name: 'Losers round 2', data: null },
    { id: 'lb-r2', type: 'lower-bracket', name: 'Losers round 3', data: null },
    { id: 'lb-r3', type: 'lower-bracket', name: 'Losers round 4', data: null },
    { id: 'final', type: 'final', name: 'Grand final', data: null },
    { id: 'reverse-final', type: 'reverse-final', name: 'Bracket reset', data: null },
  ],
  matches: [
    { id: 'ub-r0-m0', roundId: 'ub-r0', home: 'u1', away: 'u2', winner: 'home', status: 'completed', data: null },
    { id: 'ub-r0-m1', roundId: 'ub-r0', home: 'u3', away: 'u4', winner: 'home', status: 'completed', data: null },
    { id: 'ub-r0-m2', roundId: 'ub-r0', home: 'u5', away: 'u6', winner: 'home', status: 'completed', data: null },
    { id: 'ub-r0-m3', roundId: 'ub-r0', home: 'u7', away: 'u8', winner: 'home', status: 'completed', data: null },
    { id: 'ub-r1-m0', roundId: 'ub-r1', home: 'u1', away: 'u3', winner: 'home', status: 'completed', data: null },
    { id: 'ub-r1-m1', roundId: 'ub-r1', home: 'u5', away: 'u7', winner: 'home', status: 'completed', data: null },
    { id: 'ub-r2-m0', roundId: 'ub-r2', home: 'u1', away: 'u5', winner: 'home', status: 'completed', data: null },
    { id: 'lb-r0-m0', roundId: 'lb-r0', home: 'u2', away: 'u4', winner: 'home', status: 'completed', data: null },
    { id: 'lb-r0-m1', roundId: 'lb-r0', home: 'u6', away: 'u8', winner: 'home', status: 'completed', data: null },
    { id: 'lb-r1-m0', roundId: 'lb-r1', home: 'u2', away: 'u7', winner: 'home', status: 'completed', data: null },
    { id: 'lb-r1-m1', roundId: 'lb-r1', home: 'u6', away: 'u3', winner: 'home', status: 'completed', data: null },
    { id: 'lb-r2-m0', roundId: 'lb-r2', home: 'u2', away: 'u6', winner: 'home', status: 'completed', data: null },
    { id: 'lb-r3-m0', roundId: 'lb-r3', home: 'u2', away: 'u5', winner: 'home', status: 'completed', data: null },
    { id: 'final-m0', roundId: 'final', home: 'u1', away: 'u2', winner: null, status: 'pending', data: null },
    {
      id: 'reverse-final-m0',
      roundId: 'reverse-final',
      home: 'u1',
      away: 'u2',
      winner: null,
      status: 'pending',
      data: null,
    },
  ],
};
