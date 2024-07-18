// Generated Interface, do not change manually!
import { TournamentStatus } from './../Enum/Tournament/tournament.status';

export interface TournamentListView {
    id: string;
    title: string | null;
    shortTitle: string | null;
    slug: string | null;
    customIdentifier: string;
    status: TournamentStatus | null;
}

export default TournamentListView;
