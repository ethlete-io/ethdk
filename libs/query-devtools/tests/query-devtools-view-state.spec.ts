import { afterEach, describe, expect, it } from 'vitest';
import { QUERY_DEVTOOLS_VIEW_STATE_KEY, wasQueryDevtoolsOpen } from '../toggle/query-devtools-view-state';

const store = (raw: string) => {
  localStorage.setItem(QUERY_DEVTOOLS_VIEW_STATE_KEY, raw);
  sessionStorage.setItem(QUERY_DEVTOOLS_VIEW_STATE_KEY, raw);
};

describe('wasQueryDevtoolsOpen', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should be false with nothing stored', () => {
    expect(wasQueryDevtoolsOpen()).toBe(false);
  });

  it('should be true for a stored open panel', () => {
    store(JSON.stringify({ open: true }));

    expect(wasQueryDevtoolsOpen()).toBe(true);
  });

  it('should be false for a stored closed panel', () => {
    store(JSON.stringify({ open: false }));

    expect(wasQueryDevtoolsOpen()).toBe(false);
  });

  it('should only accept a boolean true', () => {
    store(JSON.stringify({ open: 'true' }));

    expect(wasQueryDevtoolsOpen()).toBe(false);
  });

  it.each(['{not json', 'null', '42', '"open"', '[]'])('should be false for the stored value %s', (raw) => {
    store(raw);

    expect(wasQueryDevtoolsOpen()).toBe(false);
  });
});
