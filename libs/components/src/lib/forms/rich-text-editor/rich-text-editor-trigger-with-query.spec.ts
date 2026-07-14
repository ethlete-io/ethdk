import { QueryCreator, QueryErrorResponse, QueryExecutionState } from '@ethlete/query';
import { firstValueFrom, Observable, Subject } from 'rxjs';
import { RichTextEditorTriggerItem } from './rich-text-editor-trigger';
import { createRichTextEditorTriggerWithQuery } from './rich-text-editor-trigger-with-query';

type UserArgs = {
  response: { items: { id: string; name: string }[] };
  queryParams: { q: string };
};

describe('createRichTextEditorTriggerWithQuery', () => {
  const setup = () => {
    const state$ = new Subject<QueryExecutionState<UserArgs> | null>();

    // a query is created once; we fake it, exposing only what the factory reads
    const fakeQuery = { executionState: { asObservable: () => state$.asObservable() } };
    let createdCount = 0;
    const queryCreator = (() => {
      createdCount++;

      return fakeQuery;
    }) as unknown as QueryCreator<UserArgs>;

    const trigger = createRichTextEditorTriggerWithQuery({
      char: '@',
      type: 'mention',
      queryCreator,
      args: (search) => ({ queryParams: { q: search() } }),
      toItems: (res) => res.items.map((u) => ({ id: u.id, label: u.name })),
    });

    const items = trigger.items as (query: string) => Observable<RichTextEditorTriggerItem[]>;

    return { state$, items, createdCount: () => createdCount };
  };

  it('creates the query once, not per keystroke', () => {
    const { items, createdCount } = setup();

    // the query is created eagerly, once, when the trigger is built
    expect(createdCount()).toBe(1);

    void items('a');
    void items('ab');

    expect(createdCount()).toBe(1);
  });

  it('maps the first settled success state to items (ignoring loading)', async () => {
    const { state$, items } = setup();

    const result = firstValueFrom(items('jane'));

    state$.next({ type: 'loading' } as QueryExecutionState<UserArgs>);
    state$.next({
      type: 'success',
      response: { items: [{ id: 'jane', name: 'Jane Doe' }] },
    } as QueryExecutionState<UserArgs>);

    expect(await result).toEqual([{ id: 'jane', label: 'Jane Doe' }]);
  });

  it('surfaces a query failure as a thrown error message (→ popup error state)', async () => {
    const { state$, items } = setup();

    const result = firstValueFrom(items('x'));
    const error = { errors: [{ message: 'Search failed' }] } as unknown as QueryErrorResponse;

    state$.next({ type: 'failure', error } as QueryExecutionState<UserArgs>);

    await expect(result).rejects.toThrow('Search failed');
  });
});
