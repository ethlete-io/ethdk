// Generated Interface, do not change manually!
import { MediaMinimalView } from './../Media/mediaMinimal.view';
import { ClubView } from './club.view';

export interface ParticipantListView {
    id: string;
    name: string;
    image: MediaMinimalView | null;
    type: string;
    profileType: string | null;
    profileId: string | null;
    number: number | null;
    footballClub: ClubView | null;
}

export default ParticipantListView;
