import { Paginated } from '@ethlete/types';
import { map } from 'rxjs';

export function mapToPaginated<T>(response: Paginated<T>) {
  return map((items) => ({ ...response, items } as Paginated<T>));
}
