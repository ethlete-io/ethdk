import { describe, expect, it } from 'vitest';
import { control } from '../../../design/control';

describe('control', () => {
  it('marks only the root element', () => {
    expect(control('<div class="a"><span></span></div>', 'box')).toBe(
      '<div data-et-control="box" data-can-animate class="a"><span></span></div>',
    );
  });

  it('marks a root without attributes', () => {
    expect(control('<button>x</button>', 'b')).toBe('<button data-et-control="b" data-can-animate>x</button>');
  });

  it('throws without a root element', () => {
    expect(() => control('plain text', 'b')).toThrow('no root element');
  });
});
