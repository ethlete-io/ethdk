export interface MemoResolver {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (...args: any[]): any;
}

export interface MapLike<K = unknown, V = unknown> {
  set(key: K, v: V): MapLike<K, V>;
  get(key: K): V;
  has(key: K): boolean;
}

export interface MemoConfig {
  resolver?: MemoResolver;
  cache?: MapLike;
}

function memoize(func: (..._args: unknown[]) => unknown, resolver: MemoResolver, cache: MapLike) {
  const memoized = function (this: unknown, ...args: unknown[]) {
    const key = resolver.apply(this, args);
    const cache = memoized.cache;

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = func.apply(this, args);
    memoized.cache = cache.set(key, result) ?? cache;
    return result;
  };

  memoized.cache = cache;

  return memoized;
}

const defaultResolver: MemoResolver = (...args: unknown[]) => args.join('-');

export const Memo =
  (config: MemoConfig = {}) =>
  (_: unknown, __: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    if (typeof descriptor.value !== 'function') {
      throw new Error('Memoization can be applied only to methods');
    }

    const resolver = config.resolver ?? defaultResolver;
    const cache = config.cache ?? new Map();

    descriptor.value = memoize(descriptor.value, resolver, cache);
    return descriptor;
  };
