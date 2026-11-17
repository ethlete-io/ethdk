import { describe, expect, it } from 'vitest';
import { addedSkipsByVariant } from './added-skips';

describe('addedSkipsByVariant', () => {
  it('groups the listed skip markers by variant in listing order', () => {
    expect(
      addedSkipsByVariant([
        { variant: 'c', part: 'elements/header', classes: 'WRAP' },
        { variant: 'a', part: 'components/card', classes: 'CLIPPED OFF-CENTRE' },
        { variant: 'c', part: 'components/card', classes: 'COVERED' },
      ]),
    ).toEqual({
      c: [
        { part: 'elements/header', classes: 'WRAP' },
        { part: 'components/card', classes: 'COVERED' },
      ],
      a: [{ part: 'components/card', classes: 'CLIPPED OFF-CENTRE' }],
    });
  });

  it('answers no variant for an empty listing', () => {
    expect(addedSkipsByVariant([])).toEqual({});
  });
});
