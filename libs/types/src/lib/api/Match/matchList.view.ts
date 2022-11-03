// Generated Interface, do not change manually!
import { MatchStatus } from './../Enum/Match/match.status';
import { OpponentSide } from './../Enum/Opponent/opponent.side';
import { StageType } from './../Enum/Stage/stage.type';
import { AbstractParticipantView } from './../Participant/abstractParticipant.view';
import { RoundListView } from './../Round/roundList.view';
import { TournamentListView } from './../Tournament/tournamentList.view';
import { TournamentGroupListView } from './../TournamentGroup/tournamentGroupList.view';
import { MatchType } from './match.type';
import { GameListViewUnion } from './../Game/gameListView.union';
import { MatchRankingView } from './matchRanking.view';

export interface MatchListView {
    id: string;
    status: MatchStatus | null;
    number: number | null;
    type: MatchType | null;
    startTime: string;
    home: AbstractParticipantView | null;
    away: AbstractParticipantView | null;
    games: GameListViewUnion[];
    judged: boolean;
    homeScore: MatchRankingView | null;
    awayScore: MatchRankingView | null;
    tournamentGroup: TournamentGroupListView | null;
    tournament: TournamentListView | null;
    round: RoundListView;
    winningSide: OpponentSide | null;
    matchType: StageType | null;
}

export default MatchListView;
