// Generated Interface, do not change manually!
import { EventListView } from './eventList.view';
import { FootballPlayerListView } from './../../FootballPlayer/footballPlayerList.view';

export interface SubstitutionEventView extends EventListView {
    inPlayer: FootballPlayerListView | null;
    outPlayer: FootballPlayerListView | null;
}

export default SubstitutionEventView;
