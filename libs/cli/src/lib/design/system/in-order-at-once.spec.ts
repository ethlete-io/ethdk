import { describe, expect, it } from 'vitest';
import { inOrderAtOnce } from './in-order-at-once';

describe('inOrderAtOnce', () => {
  it('runs up to the limit at once and returns the results in the order of the items', async () => {
    let running = 0;
    let most = 0;
    const result = await inOrderAtOnce({
      items: [50, 10, 40, 0, 30, 20],
      limit: 3,
      run: async (delay, index) => {
        running++;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, delay));
        running--;

        return `${index}:${delay}`;
      },
    });

    expect(result).toEqual(['0:50', '1:10', '2:40', '3:0', '4:30', '5:20']);
    expect(most).toBe(3);
  });

  it('starts the next item as soon as one finishes, not after a whole batch', async () => {
    const started: number[] = [];

    await inOrderAtOnce({
      items: [60, 0, 0, 0],
      limit: 2,
      run: async (delay, index) => {
        started.push(index);
        await new Promise((resolve) => setTimeout(resolve, delay));
      },
    });

    expect(started).toEqual([0, 1, 2, 3]);
  });

  it('rejects with the first failure', async () => {
    await expect(
      inOrderAtOnce({
        items: [1, 2],
        limit: 2,
        run: async (item) => {
          if (item === 2) throw new Error('two');

          return item;
        },
      }),
    ).rejects.toThrow('two');
  });
});
