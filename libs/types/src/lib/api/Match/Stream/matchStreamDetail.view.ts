// Generated Interface, do not change manually!
import { MatchStreamCategory } from './../../Enum/Match/matchStream.category';

export interface MatchStreamDetailView {
    live: boolean;
    id: string | null;
    side: string | null;
    type: string | null;
    source: string | null;
    start: string | null;
    end: string | null;
    streamer: string | null;
    category: MatchStreamCategory;
}

export default MatchStreamDetailView;
