// Generated Interface, do not change manually!
import { StatisticClubView } from '../Statistic/HeadToHead';
import { MediaMinimalView } from './../Media/mediaMinimal.view';

export interface ParticipantListView {
    id: string;
    name: string;
    image: MediaMinimalView | null;
    type: string;
    profileType: string | null;
    profileId: string | null;
    number: number | null;
    footballClub: StatisticClubView | null;
}

export default ParticipantListView;
