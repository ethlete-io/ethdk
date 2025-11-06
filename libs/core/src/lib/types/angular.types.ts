import { QueryList, Type } from '@angular/core';
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

export type HostDirective =
  | Type<unknown>
  | {
      directive: Type<unknown>;
      inputs?: string[];
      outputs?: string[];
    };

export class TypedQueryList<T> extends QueryList<T> {
  override get changes(): Observable<TypedQueryList<T>> {
    return super.changes as Observable<TypedQueryList<T>>;
  }
}
