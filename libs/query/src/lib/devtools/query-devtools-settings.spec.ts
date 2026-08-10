import {
  clearQueryDevtoolsStore,
  initQueryDevtoolsSettings,
  queryDevtoolsSettings,
  readQueryDevtoolsStore,
  setQueryDevtoolsSettings,
  writeQueryDevtoolsStore,
} from './query-devtools-settings';

const SETTINGS_KEY = 'ethlete:query:devtools:settings:v1';

const stored = () => JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');

describe('query devtools settings', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    initQueryDevtoolsSettings();
  });

  it('should default to the scopes each kind of state documented for itself', () => {
    expect(queryDevtoolsSettings()).toEqual({
      viewState: 'session',
      pins: 'local',
      overrides: 'none',
      mocks: 'local',
      armedMocks: 'none',
      armedFaults: 'none',
      maxEvents: 100,
      maxDroppedCacheEntries: 20,
      responseHistory: null,
    });
  });

  it('should store a change in localStorage, whatever the scopes are', () => {
    setQueryDevtoolsSettings({ viewState: 'none', pins: 'none' });

    expect(queryDevtoolsSettings().viewState).toBe('none');
    expect(stored()).toMatchObject({ viewState: 'none', pins: 'none' });
  });

  it('should read what it stored back on the next load', () => {
    setQueryDevtoolsSettings({ maxEvents: 250, responseHistory: 12 });
    initQueryDevtoolsSettings();

    expect(queryDevtoolsSettings()).toMatchObject({ maxEvents: 250, responseHistory: 12 });
  });

  it('should clamp a limit rather than reject it', () => {
    setQueryDevtoolsSettings({ maxEvents: 5, maxDroppedCacheEntries: 9000, responseHistory: 0 });

    expect(queryDevtoolsSettings()).toMatchObject({ maxEvents: 10, maxDroppedCacheEntries: 200, responseHistory: 1 });
  });

  it('should treat a non-number limit as no change to that limit', () => {
    setQueryDevtoolsSettings({ maxEvents: Number.NaN });

    expect(queryDevtoolsSettings().maxEvents).toBe(100);
  });

  it('should hand retention back to the application on null', () => {
    setQueryDevtoolsSettings({ responseHistory: 20 });
    setQueryDevtoolsSettings({ responseHistory: null });

    expect(queryDevtoolsSettings().responseHistory).toBeNull();
  });

  it('should fall back to the defaults for a hand-edited store', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ viewState: 'disk', maxEvents: 'lots', pins: 'session' }));
    initQueryDevtoolsSettings();

    expect(queryDevtoolsSettings()).toMatchObject({ viewState: 'session', pins: 'session', maxEvents: 100 });
  });

  it('should ignore a corrupt store rather than throw', () => {
    localStorage.setItem(SETTINGS_KEY, '{not json');
    initQueryDevtoolsSettings();

    expect(queryDevtoolsSettings().viewState).toBe('session');
  });

  it('should read and write the store a scope names, and nothing for none', () => {
    writeQueryDevtoolsStore('session', 'ethlete:test', { a: 1 });
    writeQueryDevtoolsStore('none', 'ethlete:nope', { a: 1 });

    expect(readQueryDevtoolsStore('session', 'ethlete:test')).toEqual({ a: 1 });
    expect(readQueryDevtoolsStore('local', 'ethlete:test')).toBeNull();
    expect(localStorage.getItem('ethlete:nope')).toBeNull();
    expect(sessionStorage.getItem('ethlete:nope')).toBeNull();
  });

  it('should clear a key from both stores, so a changed scope leaves no copy behind', () => {
    writeQueryDevtoolsStore('session', 'ethlete:test', { a: 1 });
    writeQueryDevtoolsStore('local', 'ethlete:test', { a: 2 });

    clearQueryDevtoolsStore('ethlete:test');

    expect(sessionStorage.getItem('ethlete:test')).toBeNull();
    expect(localStorage.getItem('ethlete:test')).toBeNull();
  });
});
