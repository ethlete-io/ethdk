import { PaginationDirective } from './headless';
import { PageSizeSelectComponent } from './page-size-select.component';
import { PaginationComponent } from './pagination.component';

export const PAGINATION_IMPORTS = [PaginationComponent, PaginationDirective] as const;

/** The "Items per page" select that pairs with the paginator (`<et-page-size-select>`). */
export const PAGE_SIZE_SELECT_IMPORTS = [PageSizeSelectComponent] as const;
