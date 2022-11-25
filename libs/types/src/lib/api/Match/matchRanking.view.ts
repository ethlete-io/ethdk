// Generated Interface, do not change manually!
import { RankingStatus } from './../Enum/Ranking/ranking.status';

export interface MatchRankingView {
    score: number | null;
    status: RankingStatus | null;
    gameAmount: number;
    gameWins: number;
    gameTies: number;
    gameLosses: number;
    ownPoints: number;
    enemyPoints: number;
    minPoints: number;
    maxPoints: number;
    place: number | null;
}

export default MatchRankingView;
