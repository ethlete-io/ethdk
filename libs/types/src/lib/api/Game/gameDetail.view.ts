// Generated Interface, do not change manually!
import { GameListView } from './gameList.view';
import { LineupListView } from './../Lineup/lineupList.view';
import { MetricListView } from './../Metric/metricList.view';
import { EventListViewUnion } from './../Game/Event/eventListView.union';

export interface GameDetailView extends GameListView {
    events: EventListViewUnion[];
    homeLineup: LineupListView | null;
    awayLineup: LineupListView | null;
    homeMetrics: MetricListView[];
    awayMetrics: MetricListView[];
}

export default GameDetailView;
