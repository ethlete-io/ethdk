// Generated Interface, do not change manually!
import { AbstractParticipantView } from './../../Participant/abstractParticipant.view';
import { MatchStreamDetailView } from './matchStreamDetail.view';

export interface MatchStreamListView {
    match: string;
    homeSide: AbstractParticipantView | null;
    awaySide: AbstractParticipantView | null;
    streams: MatchStreamDetailView[];
}

export default MatchStreamListView;
