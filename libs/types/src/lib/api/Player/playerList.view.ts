// Generated Interface, do not change manually!
import { AbstractParticipantView } from './../Participant/abstractParticipant.view';

export interface PlayerListView {
    id: string;
    name: string | null;
    displayName: string | null;
    active: boolean;
    slug: string | null;
    participant: AbstractParticipantView | null;
}

export default PlayerListView;
