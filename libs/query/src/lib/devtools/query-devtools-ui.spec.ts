import {
  markQueryDevtoolsAppSettled,
  onQueryDevtoolsUiChange,
  queryDevtoolsPillsAllowed,
  setQueryDevtoolsUiMounted,
} from './query-devtools-ui';

describe('query devtools ui presence', () => {
  it('lets the pills paint until the app settles, then only while a devtools ui is mounted', () => {
    const listener = vi.fn();
    onQueryDevtoolsUiChange(listener);

    expect(queryDevtoolsPillsAllowed()).toBe(true);

    markQueryDevtoolsAppSettled();
    expect(queryDevtoolsPillsAllowed()).toBe(false);

    setQueryDevtoolsUiMounted(true);
    setQueryDevtoolsUiMounted(true);
    setQueryDevtoolsUiMounted(false);
    expect(queryDevtoolsPillsAllowed()).toBe(true);

    setQueryDevtoolsUiMounted(false);
    expect(queryDevtoolsPillsAllowed()).toBe(false);

    setQueryDevtoolsUiMounted(false);
    setQueryDevtoolsUiMounted(true);
    expect(queryDevtoolsPillsAllowed()).toBe(true);

    expect(listener).toHaveBeenCalledTimes(7);
  });
});
