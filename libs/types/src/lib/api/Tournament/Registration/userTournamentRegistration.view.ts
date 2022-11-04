// Generated Interface, do not change manually!
import { DateTime } from './date.time';

export interface UserTournamentRegistrationView {
    id: string;
    tournamentId: string;
    userId: number;
    position: number;
    state: string | null;
    tournamentSize: number | null;
    tournamentStartDate: DateTime | null;
}

export default UserTournamentRegistrationView;
