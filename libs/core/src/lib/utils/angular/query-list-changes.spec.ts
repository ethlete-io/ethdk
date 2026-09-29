import { BehaviorSubject } from 'rxjs';
import { switchQueryListChanges, TypedQueryList } from './query-list-changes';

describe('switchQueryListChanges', () => {
  it('emits the list immediately and again on every change', () => {
    const list = new TypedQueryList<number>();
    const source$ = new BehaviorSubject<TypedQueryList<number> | null>(list);
    const seen: (TypedQueryList<number> | null)[] = [];

    source$.pipe(switchQueryListChanges()).subscribe((value) => seen.push(value));

    expect(seen).toEqual([list]);

    list.reset([1, 2]);
    list.notifyOnChanges();

    expect(seen).toEqual([list, list]);
  });

  it('emits null for a null or undefined list', () => {
    const source$ = new BehaviorSubject<TypedQueryList<number> | null | undefined>(null);
    const seen: unknown[] = [];

    source$.pipe(switchQueryListChanges()).subscribe((value) => seen.push(value));
    source$.next(undefined);

    expect(seen).toEqual([null, null]);
  });

  it('stops following a replaced list', () => {
    const first = new TypedQueryList<number>();
    const second = new TypedQueryList<number>();
    const source$ = new BehaviorSubject<TypedQueryList<number> | null>(first);
    const seen: (TypedQueryList<number> | null)[] = [];

    source$.pipe(switchQueryListChanges()).subscribe((value) => seen.push(value));
    source$.next(second);

    expect(seen).toEqual([first, second]);

    first.notifyOnChanges();

    expect(seen).toHaveLength(2);

    second.notifyOnChanges();

    expect(seen).toHaveLength(3);
  });
});
