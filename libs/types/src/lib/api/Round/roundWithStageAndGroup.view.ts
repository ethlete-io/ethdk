// Generated Interface, do not change manually!
import { StageListView } from './stageList.view';
import { GroupListView } from './groupList.view';

export interface RoundWithStageAndGroupView {
    id: string;
    number: number;
    title: string;
    state: string;
    isCurrent: boolean;
    stage: StageListView;
    group: GroupListView;
}

export default RoundWithStageAndGroupView;
