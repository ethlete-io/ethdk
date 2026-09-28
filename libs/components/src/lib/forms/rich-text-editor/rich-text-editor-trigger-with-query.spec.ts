import { signal } from '@angular/core';
import { QueryCreator, QueryErrorResponse, QueryExecutionState } from '@ethlete/query';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { RichTextEditorTriggerItem } from './rich-text-editor-trigger';
import { createRichTextEditorTriggerWithQuery } from './rich-text-editor-trigger-with-query';

type UserArgs = {
  response: { items: { id: string; name: string }[] };
  queryParams: { q: string };
};

type State = QueryExecutionState<UserArgs> | null;

describe('createRichTextEditorTriggerWithQuery', () => {
  const setup = () => {
    const executionState = signal<State>(null);
    const request = signal<{ args: { queryParams: { q: string } } } | null>(null);
    const replay$ = new BehaviorSubject<State>(null);

    // Mirrors a real query: `asObservable()` replays the last state, the signals hold the current one.
    const fakeQuery = {
      executionState: Object.assign(() => executionState(), { asObservable: () => replay$.asObservable() }),
      subtle: { request: Object.assign(() => request(), { asObservable: () => replay$.asObservable() }) },
    };
    let createdCount = 0;
    const queryCreator = (() => {
      createdCount++;

      return fakeQuery;
    }) as unknown as QueryCreator<UserArgs>;

    const trigger = createRichTextEditorTriggerWithQuery({
      char: '@',
      type: 'mention',
      queryCreator,
      args: (search) => (search() ? { queryParams: { q: search() } } : null),
      toItems: (res) => res.items.map((u) => ({ id: u.id, label: u.name })),
    });

    const emit = (q: string, state: QueryExecutionState<UserArgs>) => {
      request.set({ args: { queryParams: { q } } });
      executionState.set(state);
      replay$.next(state);
    };

    const settle = (q: string) => {
      emit(q, { type: 'loading' } as QueryExecutionState<UserArgs>);
      emit(q, {
        type: 'success',
        response: { items: [{ id: q, name: q.toUpperCase() }] },
      } as QueryExecutionState<UserArgs>);
    };

    const items = trigger.items as (query: string) => Observable<RichTextEditorTriggerItem[]>;

    return { items, emit, settle, createdCount: () => createdCount };
  };

  it('creates the query once, not per keystroke', () => {
    const { items, createdCount } = setup();

    expect(createdCount()).toBe(1);

    void items('a');
    void items('ab');

    expect(createdCount()).toBe(1);
  });

  it('waits for the execution of the new text instead of taking the replayed previous result', () => {
    const { items, settle } = setup();
    settle('a');

    const seen: RichTextEditorTriggerItem[][] = [];
    items('ab').subscribe((value) => seen.push(value));

    expect(seen).toEqual([]);

    settle('ab');

    expect(seen).toEqual([[{ id: 'ab', label: 'AB' }]]);
  });

  it('takes the current result when it already belongs to the text', () => {
    const { items, settle } = setup();
    settle('a');

    const seen: RichTextEditorTriggerItem[][] = [];
    items('a').subscribe((value) => seen.push(value));

    expect(seen).toEqual([[{ id: 'a', label: 'A' }]]);
  });

  it('resolves to no items when args skip the request', () => {
    const { items, settle } = setup();
    settle('a');

    const seen: RichTextEditorTriggerItem[][] = [];
    items('').subscribe((value) => seen.push(value));

    expect(seen).toEqual([[]]);
  });

  it('surfaces a query failure as a thrown error message (→ popup error state)', async () => {
    const { items, emit } = setup();

    const result = firstValueFrom(items('x'));
    const error = { errors: [{ message: 'Search failed' }] } as unknown as QueryErrorResponse;

    emit('x', { type: 'failure', error } as QueryExecutionState<UserArgs>);

    await expect(result).rejects.toThrow('Search failed');
  });
});
