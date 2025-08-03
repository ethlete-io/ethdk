// Generated Interface, do not change manually!
import { StageType } from './../Enum/Stage/stage.type';

export interface StageListView {
    id: string;
    name: string;
    number: number;
    type: string | null;
    isCurrent: StageType;
}

export default StageListView;
