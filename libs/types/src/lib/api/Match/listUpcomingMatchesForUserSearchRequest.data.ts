// Generated Interface, do not change manually!
import { PaginatedSearchRequestData } from './../Request/paginatedSearchRequest.data';

export type ListUpcomingMatchesForUserSearchRequestData = {

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
} & PaginatedSearchRequestData

export default ListUpcomingMatchesForUserSearchRequestData;
