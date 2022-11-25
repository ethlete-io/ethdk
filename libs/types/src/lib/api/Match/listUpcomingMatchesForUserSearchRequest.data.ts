// Generated Interface, do not change manually!
import { PaginatedSearchRequestData } from './../Request/paginatedSearchRequest.data';

export interface ListUpcomingMatchesForUserSearchRequestData extends PaginatedSearchRequestData {

    /**
     * @default "preparing"
     */
    status?: string;

    /**
     * @default "asc"
     */
    sortOrder?: string;
}

export default ListUpcomingMatchesForUserSearchRequestData;
