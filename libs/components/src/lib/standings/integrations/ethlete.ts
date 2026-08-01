import { GroupRankingView, PlacementView } from '@ethlete/types';
import { normalizeEthleteParticipant } from '../../match';
import { NormalizedStandingRow, StandingsZone } from '../standings.types';

/**
 * `PlacementView` → {@link NormalizedStandingRow}. A plain function, like every adapter in this library:
 * call it wherever the data arrives, and another API writes its own `(data) => NormalizedStandingRow`.
 *
 * `score` is what the API ranks by, so it becomes `points`; the difference is derived from the game points
 * either side has taken off the other, which is the only difference a `PlacementView` can express.
 *
 * The list views carry no form history - fill `form` in afterwards if you have it elsewhere.
 *
 * @example
 * protected rows = computed(() => this.query.response()?.placements.map(normalizeEthletePlacement) ?? []);
 */
export const normalizeEthletePlacement = (placement: PlacementView): NormalizedStandingRow => ({
  id: placement.participant?.id ?? `position-${placement.position}`,
  position: placement.position,
  participant: normalizeEthleteParticipant(placement.participant),
  played: placement.gameAmount,
  wins: placement.wins,
  ties: placement.ties,
  losses: placement.losses,
  points: placement.score,
  difference: placement.ownPoints - placement.enemyPoints,
  form: null,
});

/**
 * `GroupRankingView` → its rows plus the zone its `qualifiedPlayers` implies, which is the one piece of
 * banding the API knows about: the top N advance. The label is yours to pass, since "advance to the
 * playoffs" and "qualify for the finals" are the same field and different words.
 *
 * @example
 * protected standings = computed(() =>
 *   normalizeEthleteGroupRanking({ group: group(), advancingColor: 'success', advancingLabel: 'Advances' }),
 * );
 */
export const normalizeEthleteGroupRanking = (options: {
  group: GroupRankingView;
  /** A registered color theme name for the advancing band. Omit to get no zone at all. */
  advancingColor?: string;
  advancingLabel?: string;
}) => {
  const { group, advancingColor, advancingLabel } = options;
  const qualified = group.qualifiedPlayers ?? 0;

  const zones: StandingsZone[] =
    advancingColor && qualified > 0
      ? [{ from: 1, to: qualified, color: advancingColor, label: advancingLabel ?? 'Advances' }]
      : [];

  return {
    caption: group.groupName,
    rows: group.placements.map(normalizeEthletePlacement),
    zones,
  };
};
