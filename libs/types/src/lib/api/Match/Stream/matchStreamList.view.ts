// Generated Interface, do not change manually!
import { ParticipantListView } from './../../Participant/participantList.view';
import { MatchStreamDetailView } from './matchStreamDetail.view';

export interface MatchStreamListView {
    match: string;
    homeSide: ParticipantListView | null;
    awaySide: ParticipantListView | null;
    streams: MatchStreamDetailView[];
}

export default MatchStreamListView;
