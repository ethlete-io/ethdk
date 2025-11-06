// Generated Interface, do not change manually!
import { FormationStructureView } from './formationStructure.view';
import { LineupPlayerView } from './lineupPlayer.view';

export interface LineupListView {
    id: string;
    name: string;
    formation: FormationStructureView[];
    players: LineupPlayerView[];
}

export default LineupListView;
