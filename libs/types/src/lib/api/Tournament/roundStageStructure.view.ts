// Generated Interface, do not change manually!
import { RoundTypeEnum } from './roundType.enum';

export interface RoundStageStructureView {
    id: string;
    status: string;
    name: string | null;
    countMatches: number;
    type: RoundTypeEnum;
}

export default RoundStageStructureView;
