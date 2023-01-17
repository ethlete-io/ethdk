// Generated Interface, do not change manually!
import { PlatformListView } from './../Platform/platformList.view';
import { PlayerListView } from './../Player/playerList.view';
import { GameRankingView } from './gameRanking.view';

export interface GameListView {
    id: string;
    status: string;
    match: string;
    homePlayers: PlayerListView[];
    awayPlayers: PlayerListView[];
    homeScore: GameRankingView | null;
    awayScore: GameRankingView | null;
    judged: boolean;
    resultType: string | null;
    gameType: string | null;
    platform: PlatformListView | null;
}

export default GameListView;
