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

export class TypedQueryList<T> extends QueryList<T | undefined> {
  override [Symbol.iterator]: () => Iterator<T> = () => {
    return super[Symbol.iterator]() as Iterator<T>;
  };

  override get changes(): Observable<TypedQueryList<T>> {
    return super.changes as Observable<TypedQueryList<T>>;
  }

  override toArray(): T[] {
    return super.toArray() as T[];
  }

  override forEach(fn: (item: T, index: number, array: T[]) => void): void {
    super.forEach(fn as (item: T | undefined, index: number, array: (T | undefined)[]) => void);
  }

  override filter(fn: (item: T, index: number, array: T[]) => boolean): T[] {
    return super.filter(fn as (item: T | undefined, index: number, array: (T | undefined)[]) => boolean) as T[];
  }

  override map<U>(fn: (item: T, index: number, array: T[]) => U): U[] {
    return super.map(fn as (item: T | undefined, index: number, array: (T | undefined)[]) => U);
  }
}
