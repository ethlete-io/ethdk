// Generated Interface, do not change manually!
import { DateRangeRequestData } from './../DateRange/dateRangeRequest.data';
import { PaginatedSearchRequestData } from './../Request/paginatedSearchRequest.data';

export type ListSearchRequestData = {

    /**
     * @default null
     */
    title?: string | null;
    datePeriod: DateRangeRequestData;

    /**
     * @default []
     */
    status?: any;

    /**
     * @default []
     */
    tournamentIds?: string[];
} & PaginatedSearchRequestData

export default ListSearchRequestData;
