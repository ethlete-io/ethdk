// Generated Interface, do not change manually!
import { GameListView } from './gameList.view';
import { LineupListView } from './../Lineup/lineupList.view';
import { MetricListView } from './../Metric/metricList.view';
import { EventListViewUnion } from './../Game/Event/eventListView.union';

export type GameDetailView = {
    events: EventListViewUnion[];
    homeLineup: LineupListView | null;
    awayLineup: LineupListView | null;
    homeMetrics: MetricListView[];
    awayMetrics: MetricListView[];
} & GameListView

export default GameDetailView;
