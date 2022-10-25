// Generated Interface, do not change manually!
import { ParticipantListView } from './../Participant/participantList.view';
import { RoundListview } from './../Round/round.listview';
import { TournamentListView } from './../Tournament/tournamentList.view';
import { TournamentGroupListView } from './../TournamentGroup/tournamentGroupList.view';
import { GameListViewUnion } from './../Game/gameListView.union';
import { MatchRankingView } from './matchRanking.view';

export interface MatchListView {
    id: string;
    status: string | null;
    number: number | null;
    type: string | null;
    startTime: string;
    home: ParticipantListView | null;
    away: ParticipantListView | null;
    games: GameListViewUnion[];
    judged: boolean;
    homeScore: MatchRankingView | null;
    awayScore: MatchRankingView | null;
    tournamentGroup: TournamentGroupListView | null;
    tournament: TournamentListView | null;
    round: RoundListview;
    winningSide: string | null;
    matchType: string | null;
}

export default MatchListView;
