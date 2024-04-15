// Generated Interface, do not change manually!

import GroupListView from "../Group/groupList.view";
import StageListView from "../Stage/stageList.view";

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
