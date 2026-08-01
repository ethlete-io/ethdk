// Generated Interface, do not change manually!
import { PlacementView } from './../Ranking/Placement/placement.view';
import { RoundListView } from './../Round/roundList.view';

export type GroupRankingView = {
    groupName: string;
    qualifiedPlayers: number | null;
    placements: PlacementView[];
    currentRound: RoundListView | null;
}

export default GroupRankingView;
