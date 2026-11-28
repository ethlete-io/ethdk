import { describe, expect, it } from 'vitest';
import { TypecheckResult } from '../../typecheck';
import { startVariantTypechecks, variantKeyOf } from './check-sketches';
import { Sketch } from './sketch';

const sketch = { target: 'components/palette' } as Sketch;
const entries = ['a', 'b', 'c'].map((variant) => ({ sketch, variant }));

const deferredRuns = () => {
  const started: string[] = [];
  const finish = new Map<string, (result: TypecheckResult) => void>();
  const run = ({ variant }: { variant: string }) => {
    started.push(variant);

    return new Promise<TypecheckResult>((resolve) => finish.set(variant, resolve));
  };

  return { started, finish, run };
};

describe('startVariantTypechecks', () => {
  it('starts the first runs before it returns, so synchronous work after it does not hold them back', () => {
    const { started, run } = deferredRuns();

    startVariantTypechecks({ entries, limit: 2, run });

    expect(started).toEqual(['a', 'b']);
  });

  it('runs at most `limit` at once and starts the next when one ends', async () => {
    const { started, finish, run } = deferredRuns();
    const runs = startVariantTypechecks({ entries, limit: 2, run });

    finish.get('a')?.({ kind: 'ok' });
    await runs.get(variantKeyOf(sketch.target, 'a'));
    await Promise.resolve();

    expect(started).toEqual(['a', 'b', 'c']);

    finish.get('b')?.({ kind: 'failed', output: 'TS2322' });
    finish.get('c')?.({ kind: 'ok' });

    await expect(runs.get(variantKeyOf(sketch.target, 'b'))).resolves.toEqual({ kind: 'failed', output: 'TS2322' });
    await expect(runs.get(variantKeyOf(sketch.target, 'c'))).resolves.toEqual({ kind: 'ok' });
  });

  it('keeps a run that throws to its own key and frees its slot', async () => {
    const { started, run } = deferredRuns();
    const runs = startVariantTypechecks({
      entries,
      limit: 1,
      run: (entry) => {
        if (entry.variant === 'a') throw new Error('no tsconfig');

        return run(entry);
      },
    });

    await expect(runs.get(variantKeyOf(sketch.target, 'a'))).rejects.toThrow('no tsconfig');
    expect(started).toEqual(['b']);
  });
});
