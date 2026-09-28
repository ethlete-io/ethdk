import { Subject } from 'rxjs';
import { RichTextEditorTrigger } from '../../rich-text-editor-trigger';
import {
  RichTextEditorTriggerItemsState,
  RichTextEditorTriggerRequest,
  trackTriggerItems,
} from './rich-text-editor-trigger-source';

describe('trackTriggerItems', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const track = () => {
    const request$ = new Subject<RichTextEditorTriggerRequest>();
    const states: RichTextEditorTriggerItemsState[] = [];
    const errors: unknown[] = [];

    request$.pipe(trackTriggerItems).subscribe({ next: (s) => states.push(s), error: (e) => errors.push(e) });

    return { request$, states, errors };
  };

  it('calls a Promise source once per debounce window, not once per keystroke', async () => {
    const items = vi.fn((query: string) => Promise.resolve([{ id: query, label: query }]));
    const trigger: RichTextEditorTrigger = { char: '@', type: 'mention', items, debounceTime: 100 };
    const { request$, states } = track();

    request$.next({ trigger, query: 'a' });
    request$.next({ trigger, query: 'ab' });
    request$.next({ trigger, query: 'abc' });

    expect(items).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);

    expect(items).toHaveBeenCalledTimes(1);
    expect(items).toHaveBeenCalledWith('abc');
    expect(states.at(-1)).toEqual({ items: [{ id: 'abc', label: 'abc' }], loading: false, error: null });
  });

  it('reports a synchronous throw as an error state and keeps serving later requests', async () => {
    const failure = new Error('boom');
    let fail = true;
    const trigger: RichTextEditorTrigger = {
      char: '@',
      type: 'mention',
      debounceTime: 0,
      items: (query) => {
        if (fail) throw failure;
        return [{ id: query, label: query }];
      },
    };
    const { request$, states, errors } = track();

    request$.next({ trigger, query: 'a' });
    await vi.advanceTimersByTimeAsync(0);

    expect(errors).toEqual([]);
    expect(states.at(-1)).toEqual({ items: [], loading: false, error: failure });

    fail = false;
    request$.next({ trigger, query: 'b' });
    await vi.advanceTimersByTimeAsync(0);

    expect(states.at(-1)).toEqual({ items: [{ id: 'b', label: 'b' }], loading: false, error: null });
  });
});
