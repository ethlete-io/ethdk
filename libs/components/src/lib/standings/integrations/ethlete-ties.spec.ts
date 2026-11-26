import { EthletePlacementInput, normalizeEthleteGroupRanking } from './ethlete';

const placement = (position: number, score: number): EthletePlacementInput => ({
  participant: null,
  position,
  score,
  wins: 0,
  ties: 0,
  losses: 0,
  ownPoints: 0,
  enemyPoints: 0,
  gameAmount: 0,
});

describe('normalizeEthleteGroupRanking with tied placements', () => {
  it('keeps the API order of a tie', () => {
    const { rows } = normalizeEthleteGroupRanking({
      group: {
        groupName: 'A',
        qualifiedPlayers: null,
        placements: [placement(1, 6), placement(2, 3), placement(2, 3)],
      },
    });

    expect(rows.map((row) => row.position)).toEqual([1, 2, 2]);
  });

  it('gives participant-less rows that share a position distinct ids', () => {
    const { rows } = normalizeEthleteGroupRanking({
      group: {
        groupName: 'A',
        qualifiedPlayers: null,
        placements: [placement(1, 0), placement(1, 0), placement(1, 0)],
      },
    });

    expect(new Set(rows.map((row) => row.id)).size).toBe(3);
    expect(rows[0]?.id).toBe('position-1');
  });
});
