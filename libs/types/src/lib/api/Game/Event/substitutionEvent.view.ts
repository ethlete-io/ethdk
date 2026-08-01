// Generated Interface, do not change manually!
import { EventListView } from './eventList.view';
import { FootballPlayerListView } from './../../FootballPlayer/footballPlayerList.view';

export type SubstitutionEventView = {
    inPlayer: FootballPlayerListView | null;
    outPlayer: FootballPlayerListView | null;
} & EventListView

export default SubstitutionEventView;
