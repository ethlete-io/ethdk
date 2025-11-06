export class BracketMap<K, V> extends Map<K, V> {
  constructor() {
    super();
  }

  getOrThrow(key: K): V {
    const value = super.get(key);

    if (value === undefined) {
      throw new Error(`Value for key ${key} not found in bracket map`);
    }

    return value;
  }

  first(): V | undefined {
    return this.values().next().value;
  }

  last(): V | undefined {
    const values = Array.from(this.values());
    return values.length > 0 ? values[values.length - 1] : undefined;
  }
}
