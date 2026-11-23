import { describe, expect, it } from 'vitest';
import { SKETCHES_LABELS } from './sketches-labels';
import { START_LABELS } from './start-labels';
import { SYSTEM_LABELS } from './system-labels';

const textsOf = (value: unknown): string[] =>
  typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(textsOf) : [];

describe('Studio labels', () => {
  it('name no CLI command', () => {
    const named = [START_LABELS, SYSTEM_LABELS, SKETCHES_LABELS]
      .flatMap(textsOf)
      .filter((text) => /\bet design\b|sketch ready|Design-Check|Design-Ready|führe .* aus/.test(text));

    expect(named).toEqual([]);
  });
});
