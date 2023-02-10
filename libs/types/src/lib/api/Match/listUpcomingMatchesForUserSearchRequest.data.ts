// Generated Interface, do not change manually!
import { PaginatedSearchRequestData } from './../Request/paginatedSearchRequest.data';

export interface ListUpcomingMatchesForUserSearchRequestData extends PaginatedSearchRequestData {

    /**
     * @default ["preparing","started"]
     */
    status?: any;

    /**
     * @default null
     */
    tournament?: string | null;

    /**
     * @default "asc"
     */
    sortOrder?: string;
}

export default ListUpcomingMatchesForUserSearchRequestData;
