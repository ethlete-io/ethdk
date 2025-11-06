// Generated Interface, do not change manually!
import { MediaView } from '../../Media';
import { CheckInStatus } from './../../Registration/checkIn.status';


export interface UserTournamentRegistrationView {
    id: string;
    tournamentId: string;
    userId: number;
    position: number;
    checkInStatus: CheckInStatus;
    checkInActive: boolean;
    checkInStartAt: string | null;
    checkInEndAt: string | null;
    lastMinuteCheckInStartAt: string | null;
    lastMinuteCheckInEndAt: string | null;
    tournamentSize: number | null;
    tournamentStartDate: string | null;
    name: string | null;
    teamLogo: MediaView | null;
    tournament: any;
    tournamentGroup: any | null;
}

export default UserTournamentRegistrationView;
