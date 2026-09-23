import { stackExtent, stackValues } from './chart-stack';

describe('stackValues', () => {
  it('stacks positive values up from zero in order', () => {
    expect(stackValues([30, 20, 10])).toEqual([
      { start: 0, end: 30, isOuter: false },
      { start: 30, end: 50, isOuter: false },
      { start: 50, end: 60, isOuter: true },
    ]);
  });

  it('stacks negative values down from zero, independently of the positive ones', () => {
    expect(stackValues([30, -10, 20, -5])).toEqual([
      { start: 0, end: 30, isOuter: false },
      { start: 0, end: -10, isOuter: false },
      { start: 30, end: 50, isOuter: true },
      { start: -10, end: -15, isOuter: true },
    ]);
  });

  it('gives missing and zero values no room and never makes them the outer segment', () => {
    expect(stackValues([10, null, 5, 0, undefined, Number.NaN])).toEqual([
      { start: 0, end: 10, isOuter: false },
      { start: 10, end: 10, isOuter: false },
      { start: 10, end: 15, isOuter: true },
      { start: 15, end: 15, isOuter: false },
      { start: 15, end: 15, isOuter: false },
      { start: 15, end: 15, isOuter: false },
    ]);
  });
});

describe('stackExtent', () => {
  it('reports the positive and the negative total of every stack', () => {
    expect(stackExtent([[30, -10, 20], [5, 5], [-8]])).toEqual([50, -10, 10, 0, 0, -8]);
  });
});
