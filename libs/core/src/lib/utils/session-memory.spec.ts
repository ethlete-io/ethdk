import { canUseSessionMemory, createAutoSessionMemoryKey, createSessionMemory } from './session-memory';

const numberMemory = (key = 'memory-key') =>
  createSessionMemory<number>({
    key,
    parse: (stored) => {
      const value = Number(stored);
      return Number.isNaN(value) ? null : value;
    },
    serialize: (value) => String(value),
  });

describe('createSessionMemory', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('reads nothing before anything was written', () => {
    expect(numberMemory().read()).toBeNull();
  });

  it('round-trips a value through session storage', () => {
    const memory = numberMemory();

    expect(memory.write(12)).toBe(true);
    expect(sessionStorage.getItem('memory-key')).toBe('12');
    expect(memory.read()).toBe(12);
  });

  it('removes a stored value', () => {
    const memory = numberMemory();
    memory.write(3);

    expect(memory.remove()).toBe(true);
    expect(memory.read()).toBeNull();
  });

  it('returns null when parse rejects the stored value or throws', () => {
    sessionStorage.setItem('memory-key', 'abc');
    expect(numberMemory().read()).toBeNull();

    const throwing = createSessionMemory<number>({
      key: 'memory-key',
      parse: () => {
        throw new Error('bad');
      },
      serialize: String,
    });

    expect(throwing.read()).toBeNull();
  });

  it('reports a failed write when serialize or storage throws', () => {
    const throwing = createSessionMemory<number>({
      key: 'memory-key',
      parse: Number,
      serialize: () => {
        throw new Error('bad');
      },
    });

    expect(throwing.write(1)).toBe(false);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(numberMemory().write(1)).toBe(false);
  });

  it('reports a failed remove when storage throws', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(numberMemory().remove()).toBe(false);
  });

  it('is inert when session storage is unavailable', () => {
    vi.spyOn(globalThis, 'sessionStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const memory = numberMemory();

    expect(canUseSessionMemory()).toBe(false);
    expect(memory.write(1)).toBe(false);
    expect(memory.read()).toBeNull();
    expect(memory.remove()).toBe(false);
  });
});

describe('canUseSessionMemory', () => {
  it('is true where window, document and session storage exist', () => {
    expect(canUseSessionMemory()).toBe(true);
  });
});

describe('createAutoSessionMemoryKey', () => {
  it('builds a key from the location, element names and sibling positions', () => {
    const root = document.createElement('div');
    root.innerHTML = '<section></section><section><p></p><span id="target"></span></section>';
    document.body.append(root);

    const target = root.querySelector('#target') as HTMLElement;
    const key = createAutoSessionMemoryKey({ element: target, prefix: 'scroll' });

    expect(key.startsWith(`scroll:${location.pathname}:`)).toBe(true);
    expect(key).toMatch(/^scroll:[^:]*:html\/body\[\d+\]\/div\[\d+\]\/section\[1\]\/span\[1\]$/);

    root.remove();
  });

  it('distinguishes siblings of the same tag', () => {
    const root = document.createElement('div');
    root.innerHTML = '<i></i><i></i>';
    document.body.append(root);

    const [first, second] = Array.from(root.children) as HTMLElement[];

    expect(createAutoSessionMemoryKey({ element: first as HTMLElement, prefix: 'p' })).not.toBe(
      createAutoSessionMemoryKey({ element: second as HTMLElement, prefix: 'p' }),
    );

    root.remove();
  });

  it('names a detached root element without an index', () => {
    const detached = document.createElement('div');

    expect(createAutoSessionMemoryKey({ element: detached, prefix: 'p' })).toMatch(/:div$/);
  });
});
