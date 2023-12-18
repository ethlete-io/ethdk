// Generated Interface, do not change manually!

import { GroupListView } from "../Group";
import { StageListView } from "../Stage";

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
