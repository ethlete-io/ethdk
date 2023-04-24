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

  override reduce<U>(
    fn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U,
    initialValue: U,
  ): U {
    return super.reduce(
      fn as (previousValue: U, currentValue: T | undefined, currentIndex: number, array: (T | undefined)[]) => U,
      initialValue,
    );
  }

  override some(fn: (value: T, index: number, array: T[]) => boolean): boolean {
    return super.some(fn as (value: T | undefined, index: number, array: (T | undefined)[]) => boolean);
  }

  override find(fn: (value: T, index: number, array: T[]) => boolean): T | undefined {
    return super.find(fn as (value: T | undefined, index: number, array: (T | undefined)[]) => boolean);
  }
}
