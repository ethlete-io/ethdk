// Generated Interface, do not change manually!
import { ParticipantListView } from './../../Participant/participantList.view';

export interface PlacementView {
    participant: ParticipantListView | null;
    position: number;
    previousPosition: number | null;
    score: number;
    wins: number;
    losses: number;
    ties: number;
    ownPoints: number;
    enemyPoints: number;
    gameAmount: number;
    gameWins: number;
    gameLosses: number;
    gameTies: number;
    winPercentage: number;
    opponentsMatchWinPercentage: number;
    opponentsOpponentsMatchWinPercentage: number;
}

export default PlacementView;
