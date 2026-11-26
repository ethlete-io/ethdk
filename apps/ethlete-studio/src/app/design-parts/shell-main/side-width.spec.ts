import { clampSideWidth, SIDE_WIDTH, sideWidthForKey } from './side-width';

describe('clampSideWidth', () => {
  it('keeps a width inside the range and rounds it to whole pixels', () => {
    expect(clampSideWidth(312.4)).toBe(312);
  });

  it('stops at the minimum and the maximum', () => {
    expect(clampSideWidth(120)).toBe(SIDE_WIDTH.min);
    expect(clampSideWidth(900)).toBe(SIDE_WIDTH.max);
  });

  it('falls back to the default width for a value that is not a number', () => {
    expect(clampSideWidth(Number.NaN)).toBe(SIDE_WIDTH.rest);
  });
});

describe('sideWidthForKey', () => {
  it('moves the edge one step per arrow key', () => {
    expect(sideWidthForKey(248, 'ArrowRight')).toBe(256);
    expect(sideWidthForKey(248, 'ArrowLeft')).toBe(240);
  });

  it('does not move past the range', () => {
    expect(sideWidthForKey(204, 'ArrowLeft')).toBe(SIDE_WIDTH.min);
    expect(sideWidthForKey(398, 'ArrowRight')).toBe(SIDE_WIDTH.max);
  });

  it('ignores other keys', () => {
    expect(sideWidthForKey(248, 'ArrowUp')).toBeNull();
    expect(sideWidthForKey(248, 'Enter')).toBeNull();
  });
});
