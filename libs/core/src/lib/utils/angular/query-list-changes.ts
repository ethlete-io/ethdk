import { QueryList } from '@angular/core';
import { Observable, of, startWith, switchMap } from 'rxjs';

export class TypedQueryList<T> extends QueryList<T> {
  override get changes(): Observable<TypedQueryList<T>> {
    return super.changes as Observable<TypedQueryList<T>>;
  }
}

export function switchQueryListChanges() {
  return function <T extends TypedQueryList<unknown> | null | undefined>(source: Observable<T>) {
    return source.pipe(switchMap((value) => value?.changes.pipe(startWith(value)) ?? of(null))) as Observable<T>;
  };
}
