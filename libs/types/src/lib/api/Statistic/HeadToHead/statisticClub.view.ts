// Generated Interface, do not change manually!
import { TeamParticipantViewUnion } from './../../Participant/teamParticipantView.union';

export interface StatisticClubView {
    id: string;
    statisticConfigurationId: string;
    identityId: string;
    participant: TeamParticipantViewUnion;
    matchesPlayed: number;
    gamesPlayed: number;
    wonSum: number | null;
    lostSum: number | null;
    tieSum: number | null;
    scoreSum: number | null;
    scoreDifference: number | null;
    averagePointsPerMatch: number | null;
    gamesPlayedOneVsOne: number;
    gamesPlayedTwoVsTwo: number;
    averagePointsOneVsOnePerGame: number | null;
    averagePointsTwoVsTwoPerGame: number | null;
    averageGoalsPerGame: number | null;
    placement: number | null;
    efficiency: number | null;
    trendPoints: number | null;
    trendPointsZone: string | null;
    createdAt: string;
}

export default StatisticClubView;
