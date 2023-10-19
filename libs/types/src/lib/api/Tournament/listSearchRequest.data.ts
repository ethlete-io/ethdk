// Generated Interface, do not change manually!
import { DateRangeRequestData } from './../DateRange/dateRangeRequest.data';
import { PaginatedSearchRequestData } from './../Request/paginatedSearchRequest.data';

export interface ListSearchRequestData extends PaginatedSearchRequestData {
    datePeriod: DateRangeRequestData;

    /**
     * @default []
     */
    status?: any;

    /**
     * @default []
     */
    tournamentIds?: string[];
}

export default ListSearchRequestData;
