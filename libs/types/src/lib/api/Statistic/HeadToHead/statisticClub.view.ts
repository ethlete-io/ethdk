// Generated Interface, do not change manually!
import { TeamParticipantViewUnion } from './../../Participant/teamParticipantView.union';

export interface StatisticClubView {
    id: string;
    statisticConfigurationId: string;
    identityId: string;
    participant: TeamParticipantViewUnion;
    matchesPlayed: number;
    wonSum: number | null;
    lostSum: number | null;
    tieSum: number | null;
    scoreSum: number | null;
    averagePointsPerMatch: number | null;
    averagePointsOneVsOnePerGame: number | null;
    averagePointsTwoVsTwoPerGame: number | null;
    placement: number | null;
    efficiency: number | null;
    createdAt: string;
}

export default StatisticClubView;
