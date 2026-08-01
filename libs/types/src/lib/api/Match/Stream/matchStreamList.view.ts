// Generated Interface, do not change manually!
import { ParticipantViewUnion } from './../../Participant/participantView.union';
import { MatchStreamDetailView } from './matchStreamDetail.view';

export type MatchStreamListView = {
    match: string;
    homeSide: ParticipantViewUnion | null;
    awaySide: ParticipantViewUnion | null;
    streams: MatchStreamDetailView[];
}

export default MatchStreamListView;
