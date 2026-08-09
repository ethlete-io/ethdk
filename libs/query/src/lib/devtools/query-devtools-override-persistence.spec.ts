import {
  clearRestoredQueryDevtoolsOverrides,
  initQueryDevtoolsOverridePersistence,
  queryDevtoolsOverridePersistence,
  restoredQueryDevtoolsOverrides,
  setQueryDevtoolsOverridePersistence,
  withQueryDevtoolsOverridePersistence,
} from './query-devtools-override-persistence';
import { createQueryDevtoolsOverrides } from './query-devtools-overrides';

const STORAGE_KEY = 'ethlete:query:devtools:overrides:v1';

const register = (id: string) => withQueryDevtoolsOverridePersistence(id, createQueryDevtoolsOverrides());

const stored = () => JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');

describe('query devtools override persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
    initQueryDevtoolsOverridePersistence();
  });

  it('should default to off and store nothing', () => {
    const recorder = register('query|api|GET|/posts#0');
    recorder.arm({ type: 'set', path: ['a'], value: 1 });

    expect(queryDevtoolsOverridePersistence()).toBe(false);
    expect(stored()).toBeNull();
  });

  it('should capture what is already armed when it is switched on', () => {
    const recorder = register('query|api|GET|/posts#0');
    recorder.arm({ type: 'set', path: ['a'], value: 1 });

    setQueryDevtoolsOverridePersistence(true);

    expect(stored()).toEqual({
      enabled: true,
      ops: { 'query|api|GET|/posts#0': [{ type: 'set', path: ['a'], value: 1 }] },
    });
  });

  it('should keep writing as ops are armed and cleared', () => {
    setQueryDevtoolsOverridePersistence(true);

    const recorder = register('query|api|GET|/posts#0');
    recorder.arm({ type: 'set', path: ['a'], value: 1 });
    recorder.arm({ type: 'booleanFlip', path: ['b'] });

    expect(stored().ops['query|api|GET|/posts#0']).toHaveLength(2);

    recorder.clearAll();

    expect(stored().ops).toEqual({});
  });

  it('should replay stored ops onto a query registering under the same id', () => {
    setQueryDevtoolsOverridePersistence(true);
    register('query|api|GET|/posts#0').arm({ type: 'set', path: ['title'], value: 'edited' });

    initQueryDevtoolsOverridePersistence();
    const reloaded = register('query|api|GET|/posts#0');

    expect(reloaded.list().map((entry) => entry.op)).toEqual([{ type: 'set', path: ['title'], value: 'edited' }]);
    expect(reloaded.apply({ title: 'real' })).toEqual({ title: 'edited' });
  });

  it('should report what it re-armed and what matched no query', () => {
    setQueryDevtoolsOverridePersistence(true);
    register('query|api|GET|/posts#0').arm({ type: 'set', path: ['a'], value: 1 });
    register('query|api|GET|/gone#0').arm({ type: 'set', path: ['b'], value: 2 });

    initQueryDevtoolsOverridePersistence();
    register('query|api|GET|/posts#0');

    expect(restoredQueryDevtoolsOverrides()).toEqual([
      { id: 'query|api|GET|/posts#0', count: 1, armed: true },
      { id: 'query|api|GET|/gone#0', count: 1, armed: false },
    ]);
  });

  it('should disarm and forget everything a reload brought back', () => {
    setQueryDevtoolsOverridePersistence(true);
    register('query|api|GET|/posts#0').arm({ type: 'set', path: ['a'], value: 1 });

    initQueryDevtoolsOverridePersistence();
    const reloaded = register('query|api|GET|/posts#0');

    clearRestoredQueryDevtoolsOverrides();

    expect(reloaded.list()).toEqual([]);
    expect(restoredQueryDevtoolsOverrides()).toEqual([]);
    expect(stored().ops).toEqual({});
  });

  it('should empty the store when it is switched off, leaving armed ops alone', () => {
    setQueryDevtoolsOverridePersistence(true);
    const recorder = register('query|api|GET|/posts#0');
    recorder.arm({ type: 'set', path: ['a'], value: 1 });

    setQueryDevtoolsOverridePersistence(false);

    expect(stored()).toBeNull();
    expect(recorder.list()).toHaveLength(1);
  });

  it('should replay nothing while it is off, even with a populated store', () => {
    setQueryDevtoolsOverridePersistence(true);
    register('query|api|GET|/posts#0').arm({ type: 'set', path: ['a'], value: 1 });

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: false, ops: stored().ops }));
    initQueryDevtoolsOverridePersistence();

    expect(register('query|api|GET|/posts#0').list()).toEqual([]);
    expect(restoredQueryDevtoolsOverrides()).toEqual([]);
  });

  it('should ignore a corrupt store rather than throw', () => {
    sessionStorage.setItem(STORAGE_KEY, '{not json');
    initQueryDevtoolsOverridePersistence();

    expect(queryDevtoolsOverridePersistence()).toBe(false);
    expect(restoredQueryDevtoolsOverrides()).toEqual([]);
  });
});
