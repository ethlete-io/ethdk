import { RuntimeError } from '@ethlete/core';
import { BRACKET_ERROR_CODES } from '../bracket-errors';
export class BracketMap<TKey, TValue> extends Map<TKey, TValue> {
  constructor() {
    super();
  }

  getOrThrow(key: TKey): TValue {
    const value = super.get(key);

    if (value === undefined) {
      throw new RuntimeError(BRACKET_ERROR_CODES.DATA_LOOKUP_FAILED, `Value for key ${key} not found in bracket map`);
    }

    return value;
  }

  first(): TValue | undefined {
    return this.values().next().value;
  }

  last(): TValue | undefined {
    const values = Array.from(this.values());
    return values.length > 0 ? values[values.length - 1] : undefined;
  }
}
