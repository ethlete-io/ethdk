import { describe, expect, it, vi } from 'vitest';
import { withoutYield, withRunYield, yieldRun } from './run-yield';

describe('withoutYield', () => {
  it('hands no turn away while a draw beside it is in flight, and hands it again once it settles', async () => {
    const turn = vi.fn(async () => undefined);

    await withRunYield(turn, async () => {
      await withoutYield(async () => {
        await yieldRun();
      });
      expect(turn).not.toHaveBeenCalled();

      await yieldRun();
    });

    expect(turn).toHaveBeenCalledTimes(1);
  });
});
