// Generated Interface, do not change manually!
import { ParticipantViewUnion } from './../Participant/participantView.union';

export interface PlayerListView {
    id: string;
    name: string | null;
    displayName: string | null;
    active: boolean;
    slug: string | null;
    participant: ParticipantViewUnion | null;
}

export default PlayerListView;
