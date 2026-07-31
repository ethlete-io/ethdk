import { PaginationDirective } from './headless';
import { PageSizeSelectComponent } from './page-size-select.component';
import { PaginationComponent } from './pagination.component';

export const PAGINATION_IMPORTS = [PaginationComponent, PaginationDirective] as const;

/**
 * The "Items per page" select that pairs with the paginator (`<et-page-size-select>`). Separate
 * because plenty of paginators want no size control — and because page size is the consumer's state,
 * not the paginator's. A native `<select>`, so it pulls in nothing.
 */
export const PAGE_SIZE_SELECT_IMPORTS = [PageSizeSelectComponent] as const;
