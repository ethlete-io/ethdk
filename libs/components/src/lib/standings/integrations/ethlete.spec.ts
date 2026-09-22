import { GroupRankingView, PlacementView } from '@ethlete/types';
import {
  EthleteGroupRankingInput,
  EthletePlacementInput,
  normalizeEthleteGroupRanking,
  normalizeEthletePlacement,
} from './ethlete';

const placement = (position: number): EthletePlacementInput => ({
  participant: null,
  position,
  score: 9 - position,
  wins: 3,
  ties: 0,
  losses: 1,
  ownPoints: 10,
  enemyPoints: 4,
  gameAmount: 4,
});

describe('input types', () => {
  it('accept the generated @ethlete/types models', () => {
    expectTypeOf<PlacementView>().toExtend<EthletePlacementInput>();
    expectTypeOf<GroupRankingView>().toExtend<EthleteGroupRankingInput>();
  });
});

describe('normalizeEthletePlacement', () => {
  it('reads a participant without footballClubEmblem and a media without original', () => {
    const row = normalizeEthletePlacement({
      ...placement(1),
      participant: { id: 'p', name: 'Player', code: null, emblem: { path: '/p.png' } },
    });

    expect(row.id).toBe('p');
    expect(row.participant?.emblem).toEqual({ defaultSrc: '/p.png' });
  });
});

describe('normalizeEthleteGroupRanking', () => {
  it('maps the placements and bands the qualified positions', () => {
    const standings = normalizeEthleteGroupRanking({
      group: { groupName: 'Group A', qualifiedPlayers: 1, placements: [placement(1), placement(2)] },
      advancingColor: 'success',
    });

    expect(standings.caption).toBe('Group A');
    expect(standings.rows.map((row) => row.id)).toEqual(['position-1', 'position-2']);
    expect(standings.rows[0]).toMatchObject({ played: 4, points: 8, difference: 6 });
    expect(standings.zones).toEqual([{ from: 1, to: 1, color: 'success', label: 'Advances' }]);
  });
});
