// Generated Interface, do not change manually!
import { AbstractParticipantView } from './abstractParticipant.view';
import { ClubListView } from './../Club/clubList.view';

export interface PlayerParticipantView extends AbstractParticipantView {
    gamertag: string | null;
    club: ClubListView | null;
    mediaCollection: any[];
}

export default PlayerParticipantView;
