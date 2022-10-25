// Generated Interface, do not change manually!
import { ParticipantListView } from './../Participant/participantList.view';

export interface PlayerListView {
    id: string;
    name: string | null;
    displayName: string | null;
    active: boolean;
    slug: string | null;
    participant: ParticipantListView | null;
}

export default PlayerListView;
