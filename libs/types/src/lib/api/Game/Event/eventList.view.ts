// Generated Interface, do not change manually!
import { OpponentSide } from './../../Enum/Opponent/opponent.side';

export interface EventListView {
    id: string;
    side: OpponentSide | null;
    name: string;
    identifier: string;
    time: number | null;
    extraTime: number | null;
    position: number | null;
}

export default EventListView;
