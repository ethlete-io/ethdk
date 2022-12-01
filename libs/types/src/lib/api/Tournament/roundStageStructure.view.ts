// Generated Interface, do not change manually!
import { RoundType } from './../Enum/Round/round.type';

export interface RoundStageStructureView {
    id: string;
    status: string;
    name: string | null;
    number: number;
    countMatches: number;
    type: RoundType;
}

export default RoundStageStructureView;
