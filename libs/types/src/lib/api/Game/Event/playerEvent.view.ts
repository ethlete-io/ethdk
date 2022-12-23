// Generated Interface, do not change manually!
import { EventListView } from './eventList.view';
import { FootballPlayerListView } from './../../FootballPlayer/footballPlayerList.view';

export interface PlayerEventView extends EventListView {
    player: FootballPlayerListView | null;
}

export default PlayerEventView;
