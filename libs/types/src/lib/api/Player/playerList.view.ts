// Generated Interface, do not change manually!
import { IdentityView } from './../Identity/identity.view';
import { MediaView } from './../Media/media.view';
import { ProfileVersionMediaView } from './../Profile/profileVersionMedia.view';
import { ParticipantViewUnion } from './../Participant/participantView.union';

export interface PlayerListView {
    id: string;
    name: string | null;
    displayName: string | null;
    gamertag: string | null;
    active: boolean;
    slug: string | null;
    participant: ParticipantViewUnion | null;
    identity: IdentityView | null;
    image: MediaView | null;
    mediaCollection: ProfileVersionMediaView[];
}

export default PlayerListView;
