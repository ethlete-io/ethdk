// Generated Interface, do not change manually!
import { PaginatedSearchRequestData } from './../Pagination/paginatedSearchRequest.data';

export interface ListSearchRequestData extends PaginatedSearchRequestData {

    /**
     * @default "name"
     */
    sortBy?: string;

    /**
     * @default "asc"
     */
    sortOrder?: string;
}

export default ListSearchRequestData;
