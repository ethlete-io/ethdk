// Generated Interface, do not change manually!
import { GroupListView } from './groupList.view';
import { StageListView } from './../Stage/stageList.view';
import { RoundListView } from './roundList.view';

export interface GroupDetailView extends GroupListView {
    displayName: string;
    stage: StageListView;
    rounds: RoundListView[];
}

export default GroupDetailView;
