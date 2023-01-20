import { QueryList } from '@angular/core';
import { Observable } from 'rxjs';

export type NgClassType =
  | string
  | string[]
  | Set<string>
  | {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [klass: string]: any;
    }
  | null
  | undefined;

export class TypedQueryList<T> extends QueryList<T> {
  override get changes(): Observable<TypedQueryList<T>> {
    return super.changes as Observable<TypedQueryList<T>>;
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  override readonly first = super.first as T | undefined;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  override readonly last = super.last as T | undefined;
}
