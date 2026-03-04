import { TestBed } from '@angular/core/testing';
import { setupQueryState } from './query-state';

describe('setupQueryState', () => {
  const setup = <T>(options: Parameters<typeof setupQueryState>[0] = {}) =>
    TestBed.runInInjectionContext(() => setupQueryState<{ response: T }>(options));

  it('should initialize all signals to null', () => {
    const state = setup();
    expect(state.args()).toBeNull();
    expect(state.response()).toBeNull();
    expect(state.rawResponse()).toBeNull();
    expect(state.loading()).toBeNull();
    expect(state.error()).toBeNull();
    expect(state.latestHttpEvent()).toBeNull();
    expect(state.lastTimeExecutedAt()).toBeNull();
    expect(state.lastTriggeredBy()).toBeNull();
    expect(state.executionState()).toBeNull();
  });

  it('should expose writable signals for args, lastTimeExecutedAt and lastTriggeredBy', () => {
    const state = setup();
    state.args.set({ queryParams: { id: 1 } } as never);
    state.lastTimeExecutedAt.set(12345);
    state.lastTriggeredBy.set('poll');
    expect(state.args()).toEqual({ queryParams: { id: 1 } });
    expect(state.lastTimeExecutedAt()).toBe(12345);
    expect(state.lastTriggeredBy()).toBe('poll');
  });

  it('should apply transformResponse when provided', () => {
    const state = TestBed.runInInjectionContext(() =>
      setupQueryState<{ response: string; rawResponse: number }>({ transformResponse: (raw) => `item-${raw}` }),
    );
    // Set rawResponse directly to simulate a received payload
    state.rawResponse.set(42 as never);
    expect(state.response()).toBe('item-42');
  });

  it('should return the raw response as-is when no transformResponse is provided', () => {
    const state = setup<string>();
    state.rawResponse.set('hello' as never);
    expect(state.response()).toBe('hello');
  });
});
