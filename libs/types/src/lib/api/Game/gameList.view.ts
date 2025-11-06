// Generated Interface, do not change manually!
import { PlatformListView } from './../Platform/platformList.view';
import { PlayerListViewUnion } from './../Player/playerListView.union';
import { GameRankingView } from './gameRanking.view';

export interface GameListView {
    id: string;
    status: string;
    match: string;
    homePlayers: PlayerListViewUnion[];
    awayPlayers: PlayerListViewUnion[];
    homeScore: GameRankingView | null;
    awayScore: GameRankingView | null;
    judged: boolean;
    resultType: string | null;
    gameType: string | null;
    platform: PlatformListView | null;
    isActive: boolean;
    matchGameNumber: number | null;
    groupName: string | null;
}

export default GameListView;
