import { MediaMinimalView } from "../Media";


export interface StatisticOverallUtCardResultsView {
    goalsShot: number | null;
    playerInLineup: number | null;
    utCardFirstName: string;
    utCardLastName: string;
    utCardImage: MediaMinimalView | null;
}

export default StatisticOverallUtCardResultsView;
