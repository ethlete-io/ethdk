import { describe, expect, it } from 'vitest';
import { pinnedMediaText } from '../../../design/web/frame-scheme';

describe('pinnedMediaText', () => {
  it('makes a query of the pinned scheme always match and one of the other scheme never', () => {
    expect(pinnedMediaText('(prefers-color-scheme: dark)', 'dark')).toBe('(width >= 0)');
    expect(pinnedMediaText('(prefers-color-scheme: dark)', 'light')).toBe('(width < 0)');
    expect(pinnedMediaText('screen and (PREFERS-COLOR-SCHEME:light) and (min-width: 40rem)', 'light')).toBe(
      'screen and (width >= 0) and (min-width: 40rem)',
    );
    expect(pinnedMediaText('not all and (prefers-color-scheme: light)', 'dark')).toBe('not all and (width < 0)');
  });

  it('leaves a query without a scheme alone', () => {
    expect(pinnedMediaText('(min-width: 40rem)', 'dark')).toBe('(min-width: 40rem)');
  });
});
