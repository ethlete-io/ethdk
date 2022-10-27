// Generated Interface, do not change manually!
import { GroupListView } from './groupList.view';
import { RoundListView } from './../Round/roundList.view';
import { StageListView } from './../Stage/stageList.view';

export interface GroupDetailView extends GroupListView {
    displayName: string;
    stage: StageListView;
    rounds: RoundListView[];
}

export default GroupDetailView;
