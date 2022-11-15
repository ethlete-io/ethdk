// Generated Interface, do not change manually!
import { ParticipantViewUnion } from './../../Participant/participantView.union';

export interface PlacementView {
    participant: ParticipantViewUnion | null;
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
