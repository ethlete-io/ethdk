import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ResolvedProduct } from '../resolve-product';
import { placeholderStatesOf } from './placeholder-state';

// The foundations/logo part of client run 2026-11-24-1109, sketch variant a, as the agent left it at ready.
const LOGO_1109 = readFileSync(join(__dirname, '__fixtures__/logo-1109/logo.ts.txt'), 'utf8');

const productOf = (source: string, origin = 'product') =>
  ({ parts: [{ file: '/p/logo.ts', origin, source, cssSource: null }] }) as unknown as ResolvedProduct;

const ruleOf = (source: string, origin?: string) =>
  placeholderStatesOf(productOf(source, origin)).map(({ rule, states, message }) => ({ rule, states, message }));

describe('placeholderStatesOf', () => {
  it('names the five states of the 1109 logo whose sentence says placeholder', () => {
    expect(ruleOf(LOGO_1109)).toEqual([
      {
        rule: 'PLACEHOLDER',
        states: ['anatomy', 'clear-space', 'colour-variants', 'misuse', 'motion'],
        message: expect.stringMatching(/calls the state a placeholder/u),
      },
    ]);
  });

  it('passes the logo once every sentence describes what its state draws', () => {
    const drawn = LOGO_1109.replace(/Placeholder until the pick: /gu, '');

    expect(ruleOf(drawn)).toEqual([]);
  });

  it('passes a field whose sentence speaks about its placeholder text', () => {
    const field = `import { definePart } from '@design-system';
export default definePart({
  note: 'Ein Suchfeld mit Platzhalter.',
  states: { empty: {}, filled: {} },
  describe: { empty: 'The field shows its placeholder in a muted colour.', filled: 'Der Platzhalter ist weg.' },
  render: () => ({ body: '' }),
});
`;

    expect(ruleOf(field)).toEqual([]);
  });

  it('names a German note that calls the part a placeholder', () => {
    const note = LOGO_1109.replace(/note: '[^']*'/u, "note: 'Vorerst nur ein Platzhalter.'").replace(
      /Placeholder until the pick: /gu,
      '',
    );

    expect(ruleOf(note)).toEqual([
      {
        rule: 'PLACEHOLDER',
        states: undefined,
        message: 'the note calls the part a placeholder - draw it before ready',
      },
    ]);
  });

  it('leaves a part of the base alone', () => {
    expect(ruleOf(LOGO_1109, 'base')).toEqual([]);
  });
});
