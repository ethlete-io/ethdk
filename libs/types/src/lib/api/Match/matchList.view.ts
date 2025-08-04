// Generated Interface, do not change manually!
import { MatchStatus } from './../Enum/Match/match.status';
import { MatchType } from './../Enum/Match/match.type';
import { OpponentSide } from './../Enum/Opponent/opponent.side';
import { StageType } from './../Enum/Stage/stage.type';
import { RoundListView } from './../Round/roundList.view';
import { StageListView } from './../Stage/stageList.view';
import { TournamentListView } from './../Tournament/tournamentList.view';
import { TournamentGroupListView } from './../TournamentGroup/tournamentGroupList.view';
import { ParticipantViewUnion } from './../Participant/participantView.union';
import { GameListViewUnion } from './../Game/gameListView.union';
import { MatchRankingView } from './matchRanking.view';

export interface MatchListView {
    id: string;
    status: MatchStatus | null;
    number: number | null;
    type: MatchType | null;
    startTime: string;
    home: ParticipantViewUnion | null;
    away: ParticipantViewUnion | null;
    games: GameListViewUnion[];
    judged: boolean;
    homeScore: MatchRankingView | null;
    awayScore: MatchRankingView | null;
    tournamentGroup: TournamentGroupListView | null;
    tournament: TournamentListView | null;
    round: RoundListView;
    winningSide: OpponentSide | null;
    matchType: StageType | null;
    isCompletedByReferee: boolean;
    matchCategory: number;
    stage: StageListView;
}

export default MatchListView;
