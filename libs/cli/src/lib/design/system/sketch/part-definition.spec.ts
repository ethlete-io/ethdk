import { describe, expect, it } from 'vitest';
import { stateNamesOf, widthsOf, withNote } from './part-definition';

const part = `import { definePart } from '@design-system';
export default definePart({
  note: 'Old reason.',
  states: { default: { a: 1 }, 'very-long': { a: 2 } },
  render: () => null,
});
`;

describe('stateNamesOf', () => {
  it('reads the state names of a definePart literal', () => {
    expect(stateNamesOf(part)).toEqual(['default', 'very-long']);
  });

  it('answers null when the states are not a literal', () => {
    expect(stateNamesOf(part.replace(/states: \{.*\},\n/u, 'states,\n'))).toBeNull();
    expect(stateNamesOf('export default 1;')).toBeNull();
  });
});

describe('withNote', () => {
  it('replaces the note literal and escapes the new one', () => {
    const noted = withNote(part, "Variant b, because it's\nbolder.");

    expect(noted).toContain("note: 'Variant b, because it\\'s\\nbolder.',");
    expect(noted).not.toContain('Old reason.');
    expect(stateNamesOf(noted ?? '')).toEqual(['default', 'very-long']);
  });

  it('answers null without a note literal', () => {
    expect(withNote(part.replace("'Old reason.'", 'reason'), 'x')).toBeNull();
  });
});

describe('widthsOf', () => {
  it('reads a literal list, an absent one as empty, and anything else as unknown', () => {
    expect(widthsOf(`export default definePart({ widths: [240, 520], states: {} });`)).toEqual([240, 520]);
    expect(widthsOf(`export default definePart({ states: {} });`)).toEqual([]);
    expect(widthsOf(`export default definePart({ widths: WIDTHS, states: {} });`)).toBeNull();
  });
});
