// Generated Interface, do not change manually!
import { PaginatedSearchRequestData } from './../Pagination/paginatedSearchRequest.data';

export interface ListSearchRequestData extends PaginatedSearchRequestData {

    /**
     * @default null
     */
    stage?: string | null;

    /**
     * @default "number"
     */
    sortBy?: string;

    /**
     * @default "asc"
     */
    sortOrder?: string;

    /**
     * @default null
     */
    status?: any | null;

    /**
     * @default null
     */
    startTimeBefore?: string | null;

    /**
     * @default null
     */
    startTimeAfter?: string | null;

    /**
     * @default null
     */
    group?: string | null;

    /**
     * @default null
     */
    round?: string | null;
}

export default ListSearchRequestData;
