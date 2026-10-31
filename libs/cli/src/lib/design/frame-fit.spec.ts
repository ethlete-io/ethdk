import { describe, expect, it } from 'vitest';
import { fitRoot } from '../../../design/web/frame-fit';

const rootOf = () => {
  const page = { style: {} as Record<string, string> };
  const root = { style: {} as Record<string, string>, ownerDocument: { documentElement: page } };

  return { page, root };
};

describe('fitRoot', () => {
  it('sizes the root to its content inside a padding', () => {
    const { page, root } = rootOf();

    fitRoot(root as unknown as HTMLElement, { padded: true });

    expect(page.style).toEqual({ overflow: 'hidden' });
    expect(root.style).toEqual({ width: 'max-content', padding: '16px' });
  });

  it('leaves the padding out for a bare root', () => {
    const { root } = rootOf();

    fitRoot(root as unknown as HTMLElement, { padded: false });

    expect(root.style).toEqual({ width: 'max-content' });
  });
});
