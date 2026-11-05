import {
  markQueryDevtoolsAppSettled,
  onQueryDevtoolsUiChange,
  isQueryDevtoolsHiddenInAutomation,
  queryDevtoolsPillsAllowed,
  setQueryDevtoolsShowInAutomation,
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

  describe('automation', () => {
    const setWebdriver = (value: boolean | undefined) =>
      Object.defineProperty(navigator, 'webdriver', { configurable: true, value });

    afterEach(() => {
      setWebdriver(undefined);
      setQueryDevtoolsShowInAutomation(false);
    });

    it('hides the devtools UI and the pills under navigator.webdriver, unless showInAutomation is set', () => {
      setQueryDevtoolsUiMounted(true);

      expect(isQueryDevtoolsHiddenInAutomation()).toBe(false);
      expect(queryDevtoolsPillsAllowed()).toBe(true);

      setWebdriver(true);

      expect(isQueryDevtoolsHiddenInAutomation()).toBe(true);
      expect(queryDevtoolsPillsAllowed()).toBe(false);

      setQueryDevtoolsShowInAutomation(true);

      expect(isQueryDevtoolsHiddenInAutomation()).toBe(false);
      expect(queryDevtoolsPillsAllowed()).toBe(true);

      setQueryDevtoolsUiMounted(false);
    });
  });
});
