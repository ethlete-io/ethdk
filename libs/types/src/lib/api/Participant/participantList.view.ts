// Generated Interface, do not change manually!
import { ClubListView } from '../Club';
import { MediaMinimalView } from './../Media/mediaMinimal.view';

export interface ParticipantListView {
    id: string;
    name: string;
    image: MediaMinimalView | null;
    type: string;
    profileType: string | null;
    profileId: string | null;
    number: number | null;
    footballClub: ClubListView | null;
}

export default ParticipantListView;
