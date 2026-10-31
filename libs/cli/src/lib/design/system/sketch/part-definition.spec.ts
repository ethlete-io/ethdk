import { describe, expect, it } from 'vitest';
import { declaresControlsOf, stateNamesOf, unreachableOf, widthsOf, withMadeBy, withNote } from './part-definition';

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

describe('withMadeBy', () => {
  it('writes madeBy next to the note, and a later call replaces it', () => {
    const made = withMadeBy(part, ['gemini-3-argon', 'gpt-5.6-sol']) ?? '';

    expect(made).toContain("  note: 'Old reason.',\n  madeBy: ['gemini-3-argon', 'gpt-5.6-sol'],\n  states:");
    expect(withMadeBy(made, ['claude-opus-5-5'])).toBe(
      made.replace("'gemini-3-argon', 'gpt-5.6-sol'", "'claude-opus-5-5'"),
    );
  });

  it('removes madeBy for no authors, and answers null without a note', () => {
    expect(withMadeBy(withMadeBy(part, ['gpt-5.6-sol']) ?? '', [])).toBe(part);
    expect(withMadeBy(part, [])).toBe(part);
    expect(withMadeBy('export default definePart({ states: {} });', ['x'])).toBeNull();
  });
});

describe('widthsOf', () => {
  it('reads a literal list, an absent one as empty, and anything else as unknown', () => {
    expect(widthsOf(`export default definePart({ widths: [240, 520], states: {} });`)).toEqual([240, 520]);
    expect(widthsOf(`export default definePart({ states: {} });`)).toEqual([]);
    expect(widthsOf(`export default definePart({ widths: WIDTHS, states: {} });`)).toBeNull();
  });
});

describe('declaresControlsOf', () => {
  it('answers whether definePart declares a control', () => {
    expect(declaresControlsOf(part)).toBe(false);
    expect(declaresControlsOf(part.replace('render:', 'controls: {},\n  render:'))).toBe(false);
    expect(declaresControlsOf(part.replace('render:', "controls: { a: { kind: 'button' } },\n  render:"))).toBe(true);
    expect(declaresControlsOf(part.replace('render:', 'controls,\n  render:'))).toBe(true);
  });
});

describe('unreachableOf', () => {
  const withUnreachable = (value: string) => part.replace('render:', `unreachable: ${value},\n  render:`);

  it('reads literal pairs, none without the field, and null for a value that is no array literal', () => {
    expect(unreachableOf(part)).toEqual([]);
    expect(unreachableOf(withUnreachable("[{ from: 'default', to: 'very-long', reason: 'Set by the app.' }]"))).toEqual(
      [{ from: 'default', to: 'very-long', reason: 'Set by the app.', literal: true }],
    );
    expect(unreachableOf(withUnreachable('pairs'))).toBeNull();
  });

  it('marks an entry or a field that is no literal, and leaves a missing reason null', () => {
    expect(
      unreachableOf(withUnreachable("[pair, { from: state, to: 'default', reason: 'x' }, { from: 'a', to: 'b' }]")),
    ).toEqual([
      { from: null, to: null, reason: null, literal: false },
      { from: null, to: 'default', reason: 'x', literal: false },
      { from: 'a', to: 'b', reason: null, literal: true },
    ]);
  });
});
