import { Observable, of, startWith, switchMap } from 'rxjs';
import { TypedQueryList } from '../types';

export function switchQueryListChanges() {
  return function <T extends TypedQueryList<unknown> | null | undefined>(source: Observable<T>) {
    return source.pipe(switchMap((value) => value?.changes.pipe(startWith(value)) ?? of(null))) as Observable<T>;
  };
}
