// Generated Interface, do not change manually!

export interface UserTournamentRegistrationView {
    id: string;
    tournamentId: string;
    userId: number;
    position: number;
    checkInStatus: string;
    checkInActive: boolean;
    checkInStartAt: string | null;
    checkInEndAt: string | null;
    lastMinuteCheckInStartAt: string | null;
    lastMinuteCheckInEndAt: string | null;
    tournamentSize: number | null;
    tournamentStartDate: string | null;
    tournament: any;
    tournamentGroup: any | null;
}

export default UserTournamentRegistrationView;
