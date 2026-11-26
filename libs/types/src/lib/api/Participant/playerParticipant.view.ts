// Generated Interface, do not change manually!
import { AbstractParticipantView } from './abstractParticipant.view';
import { ClubListView } from './../Club/clubList.view';

export type PlayerParticipantView = {
    gamertag: string | null;
    club: ClubListView | null;
    mediaCollection: any[];
} & AbstractParticipantView

export default PlayerParticipantView;
