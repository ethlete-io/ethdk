import { computeAutosizeBlockSize } from './textarea-autosize';

describe('computeAutosizeBlockSize', () => {
  const base = { lineHeight: 20, paddingBlock: 8, borderBlock: 2 };

  it('grows with the content', () => {
    const result = computeAutosizeBlockSize(
      { ...base, contentBlockSize: 108 }, // 5 lines + padding
      { minRows: 3, maxRows: null },
    );

    expect(result).toBe(110); // content + border
  });

  it('clamps to minRows when the content is smaller', () => {
    const result = computeAutosizeBlockSize(
      { ...base, contentBlockSize: 28 }, // 1 line + padding
      { minRows: 3, maxRows: null },
    );

    expect(result).toBe(3 * 20 + 8 + 2);
  });

  it('clamps to maxRows when the content is larger', () => {
    const result = computeAutosizeBlockSize(
      { ...base, contentBlockSize: 408 }, // 20 lines + padding
      { minRows: 3, maxRows: 6 },
    );

    expect(result).toBe(6 * 20 + 8 + 2);
  });

  it('has no upper bound when maxRows is null', () => {
    const result = computeAutosizeBlockSize({ ...base, contentBlockSize: 2008 }, { minRows: 3, maxRows: null });

    expect(result).toBe(2010);
  });

  it('treats equal min and max rows as a fixed size', () => {
    const short = computeAutosizeBlockSize({ ...base, contentBlockSize: 28 }, { minRows: 4, maxRows: 4 });
    const long = computeAutosizeBlockSize({ ...base, contentBlockSize: 408 }, { minRows: 4, maxRows: 4 });

    expect(short).toBe(long);
    expect(short).toBe(4 * 20 + 8 + 2);
  });
});
