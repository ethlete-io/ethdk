/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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
