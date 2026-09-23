import { createBandScale, createBarPath, createLinearScale, createValueTicks } from './chart-scale';

describe('createValueTicks', () => {
  it('rounds the domain out to a nice step that starts at zero', () => {
    expect(createValueTicks([12, 87, 40], 5)).toEqual({ domain: [0, 100], step: 20, ticks: [0, 20, 40, 60, 80, 100] });
  });

  it('picks a 1, 2 or 5 step for the requested tick count', () => {
    expect(createValueTicks([1234], 5).step).toBe(200);
    expect(createValueTicks([1234], 10).step).toBe(100);
    expect(createValueTicks([9], 5).step).toBe(2);
  });

  it('emits decimal ticks without floating point noise', () => {
    expect(createValueTicks([0.1, 0.3], 5).ticks).toEqual([0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]);
  });

  it('extends below zero for negative values', () => {
    expect(createValueTicks([-35, 80], 5)).toEqual({
      domain: [-40, 80],
      step: 20,
      ticks: [-40, -20, 0, 20, 40, 60, 80],
    });
  });

  it('keeps a non-empty domain when every value is zero or missing', () => {
    expect(createValueTicks([0, 0], 5).domain).toEqual([0, 1]);
    expect(createValueTicks([], 5).domain).toEqual([0, 1]);
    expect(createValueTicks([Number.NaN, 4], 4).domain).toEqual([0, 4]);
  });
});

describe('createLinearScale', () => {
  it('maps the domain onto an inverted pixel range', () => {
    const scale = createLinearScale([0, 100], [200, 0]);

    expect(scale(0)).toBe(200);
    expect(scale(25)).toBe(150);
    expect(scale(100)).toBe(0);
  });

  it('maps a collapsed domain to the range start', () => {
    expect(createLinearScale([5, 5], [200, 0])(5)).toBe(200);
  });
});

describe('createBandScale', () => {
  it('caps the bar width and centers it in its band', () => {
    const scale = createBandScale({ count: 3, width: 300, maxBandWidth: 24, gap: 2 });

    expect(scale.step).toBe(100);
    expect(scale.bandWidth).toBe(24);
    expect(scale.bandStart(0)).toBe(38);
    expect(scale.bandStart(2)).toBe(238);
  });

  it('leaves the gap between neighbours when the bands are narrow', () => {
    const scale = createBandScale({ count: 6, width: 60, maxBandWidth: 24, gap: 2 });

    expect(scale.bandWidth).toBe(8);
    expect(scale.bandStart(1) - (scale.bandStart(0) + scale.bandWidth)).toBe(2);
  });

  it('draws nothing without categories', () => {
    expect(createBandScale({ count: 0, width: 300, maxBandWidth: 24, gap: 2 }).bandWidth).toBe(0);
  });

  it('gives a lone bar its whole band as the hit target', () => {
    expect(createBandScale({ count: 3, width: 300, maxBandWidth: 24, gap: 2 }).memberSlot(1)).toEqual({
      start: 100,
      size: 100,
    });
  });
});

describe('createBandScale with a group', () => {
  it('centers the group in its band, with the gap between its bars', () => {
    const scale = createBandScale({ count: 3, width: 300, maxBandWidth: 24, gap: 2, groupSize: 2 });

    expect(scale.bandWidth).toBe(24);
    expect(scale.bandStart(0, 0)).toBe(25);
    expect(scale.bandStart(0, 1)).toBe(51);
    expect(scale.bandStart(2, 1)).toBe(251);
  });

  it('keeps air between groups when the bars have to shrink', () => {
    const scale = createBandScale({ count: 4, width: 200, maxBandWidth: 24, gap: 2, groupSize: 3 });

    expect(scale.bandWidth).toBeCloseTo((50 - 10 - 4) / 3);
    expect(scale.bandStart(1, 0) - (scale.bandStart(0, 2) + scale.bandWidth)).toBeCloseTo(10);
    expect(scale.bandStart(0, 1) - (scale.bandStart(0, 0) + scale.bandWidth)).toBeCloseTo(2);
  });

  it('tiles the band between its bars, splitting each gap in half', () => {
    const scale = createBandScale({ count: 3, width: 300, maxBandWidth: 24, gap: 2, groupSize: 2 });

    expect(scale.memberSlot(1, 0)).toEqual({ start: 100, size: 50 });
    expect(scale.memberSlot(1, 1)).toEqual({ start: 150, size: 50 });
  });
});

describe('createBarPath', () => {
  it('rounds the top corners and keeps the baseline square', () => {
    expect(createBarPath({ x: 10, y: 20, width: 24, height: 100, radius: 4, roundedEnd: 'top' })).toBe(
      'M10,120V24A4,4 0 0 1 14,20H30A4,4 0 0 1 34,24V120Z',
    );
  });

  it('rounds the bottom corners of a negative bar', () => {
    expect(createBarPath({ x: 0, y: 50, width: 10, height: 30, radius: 4, roundedEnd: 'bottom' })).toBe(
      'M0,50H10V76A4,4 0 0 1 6,80H4A4,4 0 0 1 0,76Z',
    );
  });

  it('shrinks the radius to fit a short bar', () => {
    expect(createBarPath({ x: 0, y: 0, width: 10, height: 2, radius: 4, roundedEnd: 'top' })).toBe(
      'M0,2V2A2,2 0 0 1 2,0H8A2,2 0 0 1 10,2V2Z',
    );
  });

  it('rounds the right end of a horizontal bar', () => {
    expect(createBarPath({ x: 10, y: 0, width: 50, height: 20, radius: 4, roundedEnd: 'right' })).toBe(
      'M10,0H56A4,4 0 0 1 60,4V16A4,4 0 0 1 56,20H10Z',
    );
  });

  it('rounds the left end of a negative horizontal bar', () => {
    expect(createBarPath({ x: 10, y: 0, width: 50, height: 20, radius: 4, roundedEnd: 'left' })).toBe(
      'M60,0V20H14A4,4 0 0 1 10,16V4A4,4 0 0 1 14,0Z',
    );
  });

  it('keeps every corner square for an inner stacked segment', () => {
    expect(createBarPath({ x: 0, y: 10, width: 24, height: 30, radius: 4, roundedEnd: 'none' })).toBe('M0,10H24V40H0Z');
  });

  it('draws nothing for a zero-height bar', () => {
    expect(createBarPath({ x: 0, y: 0, width: 10, height: 0, radius: 4, roundedEnd: 'top' })).toBe('');
  });
});
