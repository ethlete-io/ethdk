import { PaginationView } from './api';

export interface Paginated<T> extends PaginationView {
  items: T[];
}
