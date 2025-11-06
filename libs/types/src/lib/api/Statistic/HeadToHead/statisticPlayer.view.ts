// Generated Interface, do not change manually!
import { PlayerParticipantView } from './../../Participant/playerParticipant.view';
import { PlayerListViewUnion } from './../../Player/playerListView.union';

export interface StatisticPlayerView {
    id: string;
    statisticConfigurationId: string;
    identityId: string;
    participant: PlayerParticipantView | null;
    player: PlayerListViewUnion | null;
    gamesPlayed: number;
    wonSum: number | null;
    lostSum: number | null;
    tieSum: number | null;
    scoreSum: number | null;
    scoreDifference: number | null;
    averageGoalsPerGame: number | null;
    averageEnemyGoalsPerGame: number | null;
    averagePointsPerGame: number | null;
    averageShotsPerGoal: number | null;
    averageBallRecoveryTimePerGame: number | null;
    efficiency: number | null;
    trendPoints: number | null;
    trendPointsZone: string | null;
    averageExpectedScorePerGame: number | null;
    createdAt: string;
}

export default StatisticPlayerView;
