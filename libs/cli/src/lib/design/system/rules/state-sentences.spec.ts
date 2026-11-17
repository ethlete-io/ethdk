import { describe, expect, it } from 'vitest';
import { ResolvedProduct } from '../resolve-product';
import { missingStateSentencesOf } from './state-sentences';

const productOf = (...parts: { source: string; origin?: string }[]) =>
  ({
    parts: parts.map(({ source, origin = 'product' }, index) => ({ file: `/p/part-${index}.ts`, origin, source })),
  }) as unknown as ResolvedProduct;

const partWith = (describe: string) => `import { definePart } from '@design-system';
export default definePart({
  note: '',
  states: { rest: {}, open: {} },
  ${describe}
  render: () => ({ body: '', styles: '' }),
});
`;

const messagesOf = (product: ResolvedProduct) =>
  missingStateSentencesOf(product).map((problem) => `${problem.rule} ${problem.file} ${problem.message}`);

describe('missingStateSentencesOf', () => {
  it('passes a part that gives every state a sentence', () => {
    expect(
      messagesOf(
        productOf({
          source: partWith("describe: { rest: 'Closed; check the label.', open: 'Open; check the panel.' },"),
        }),
      ),
    ).toEqual([]);
  });

  it('names a part without describe', () => {
    expect(messagesOf(productOf({ source: partWith('') }))).toEqual([
      expect.stringMatching(/^STATE-SENTENCE \/p\/part-0\.ts no state has a sentence/u),
    ]);
  });

  it('names each state whose sentence is missing or blank', () => {
    expect(messagesOf(productOf({ source: partWith("describe: { rest: '  ' },") }))).toEqual([
      'STATE-SENTENCE /p/part-0.ts state without a sentence in describe: rest, open (ADR 0330)',
    ]);
  });

  it('leaves base parts and sentences it cannot read without running the part to their own check', () => {
    expect(
      messagesOf(productOf({ source: partWith(''), origin: 'base' }, { source: partWith('describe: sentences,') })),
    ).toEqual([]);
  });
});
