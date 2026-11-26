import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { stateNamesOf } from './sketch/part-definition';
import { calledNamesOf, textsOf } from './ts-source';

vi.mock('typescript', async (importOriginal) => {
  const actual = await importOriginal<{ default: typeof ts }>();

  return { default: { ...actual.default, createSourceFile: vi.fn(actual.default.createSourceFile) } };
});

describe('sourceFileOf', () => {
  it('parses a part source once for every rule that reads it', () => {
    const source = `
      import { definePart } from '@design-system';
      export default definePart({ note: 'a', states: { rest: () => '<p class="x">y</p>' } });
    `;
    const parses = vi.mocked(ts.createSourceFile);

    parses.mockClear();
    textsOf(source);
    calledNamesOf(source);
    stateNamesOf(source);
    stateNamesOf(source);

    expect(parses).toHaveBeenCalledTimes(1);
  });
});
