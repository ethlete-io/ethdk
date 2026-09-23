import { createArcPath, createArcPoint, createWholePercentages, placementForAngle } from './chart-arc';

const TAU = Math.PI * 2;

type Command = { type: string; args: number[] };

const parsePath = (path: string): Command[] =>
  [...path.matchAll(/([MLAZ])([^MLAZ]*)/g)].map((match) => ({
    type: match[1] ?? '',
    args: (match[2] ?? '')
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number),
  }));

const arcs = (path: string) => parsePath(path).filter((command) => command.type === 'A');

const base = { cx: 100, cy: 100, outerRadius: 100, innerRadius: 0, gap: 0 };

describe('createArcPath', () => {
  it('draws a quarter pie from 12 to 3 o’clock, clockwise, with its apex in the centre', () => {
    const commands = parsePath(createArcPath({ ...base, startAngle: 0, endAngle: TAU / 4 }));

    expect(commands.map((command) => command.type)).toEqual(['M', 'A', 'L', 'Z']);
    expect(commands[0]?.args).toEqual([100, 0]);
    expect(commands[1]?.args).toEqual([100, 100, 0, 0, 1, 200, 100]);
    expect(commands[2]?.args).toEqual([100, 100]);
  });

  it('sets the large-arc flag only for a sweep over half a turn', () => {
    const under = arcs(createArcPath({ ...base, startAngle: 0, endAngle: Math.PI * 0.99 }));
    const over = arcs(createArcPath({ ...base, startAngle: 0, endAngle: Math.PI * 1.01 }));
    const threeQuarters = arcs(createArcPath({ ...base, startAngle: 0, endAngle: TAU * 0.75 }));

    expect(under[0]?.args[3]).toBe(0);
    expect(over[0]?.args[3]).toBe(1);
    expect(threeQuarters[0]?.args[3]).toBe(1);
    expect(threeQuarters[0]?.args.slice(5)).toEqual([0, 100]);
  });

  it('sets the inner arc’s large-arc flag by its own sweep, drawn counter-clockwise', () => {
    const [outer, inner] = arcs(createArcPath({ ...base, innerRadius: 50, startAngle: 0, endAngle: TAU * 0.75 }));

    expect(outer?.args.slice(3, 5)).toEqual([1, 1]);
    expect(inner?.args.slice(0, 5)).toEqual([50, 50, 0, 1, 0]);
    expect(inner?.args.slice(5)).toEqual([100, 50]);
  });

  it('draws a full turn as a closed disc of two half arcs', () => {
    const path = createArcPath({ ...base, startAngle: 0, endAngle: TAU, gap: 2 });

    expect(path).toBe('M100,0A100,100 0 1 1 100,200A100,100 0 1 1 100,0Z');
  });

  it('draws a full donut turn as a ring: an outer circle and a reversed inner circle', () => {
    const path = createArcPath({ ...base, innerRadius: 60, startAngle: 0, endAngle: TAU });

    expect(path).toBe(
      'M100,0A100,100 0 1 1 100,200A100,100 0 1 1 100,0ZM100,40A60,60 0 1 0 100,160A60,60 0 1 0 100,40Z',
    );
  });

  it('draws nothing for an empty or reversed sweep, or a circle without radius', () => {
    expect(createArcPath({ ...base, startAngle: 1, endAngle: 1 })).toBe('');
    expect(createArcPath({ ...base, startAngle: 1, endAngle: 0.5 })).toBe('');
    expect(createArcPath({ ...base, outerRadius: 0, startAngle: 0, endAngle: 1 })).toBe('');
  });

  it('cuts a gap of constant width: each edge moves gap/2 off the slice boundary, at every radius', () => {
    const gap = 4;
    const [move, outer, line, inner] = parsePath(
      createArcPath({ ...base, innerRadius: 40, startAngle: 0, endAngle: TAU / 4, gap }),
    );

    expect(move?.args[0]).toBeCloseTo(100 + gap / 2, 2);
    expect(outer?.args[6]).toBeCloseTo(100 - gap / 2, 2);
    expect(line?.args[1]).toBeCloseTo(100 - gap / 2, 2);
    expect(inner?.args[5]).toBeCloseTo(100 + gap / 2, 2);
  });

  it('moves a pie slice’s apex off the centre along its bisector, so both edges keep the gap', () => {
    const gap = 4;
    const commands = parsePath(createArcPath({ ...base, startAngle: 0, endAngle: TAU / 4, gap }));
    const apex = commands[2]?.args ?? [];

    expect(commands[2]?.type).toBe('L');
    expect(apex[0]).toBeCloseTo(100 + gap / 2, 2);
    expect(apex[1]).toBeCloseTo(100 - gap / 2, 2);
  });

  it('moves the apex of a reflex slice onto its bisector too, keeping both edges gap/2 away', () => {
    const apex = parsePath(createArcPath({ ...base, startAngle: 0, endAngle: TAU * 0.75, gap: 4 }))[2]?.args ?? [];

    expect(apex[0]).toBeCloseTo(102, 2);
    expect(apex[1]).toBeCloseTo(102, 2);
  });

  it('narrows the gap of a slice thinner than the gap, keeping 1px of its outer arc', () => {
    const sweep = 1 / 100;
    const commands = parsePath(createArcPath({ ...base, startAngle: 0, endAngle: sweep * 2, gap: 20 }));
    const start = commands[0]?.args ?? [];
    const end = commands[1]?.args.slice(5) ?? [];

    expect(Math.hypot((end[0] ?? 0) - (start[0] ?? 0), (end[1] ?? 0) - (start[1] ?? 0))).toBeCloseTo(1, 2);
  });

  it('collapses a donut segment’s inner edge to a point when the gap would close it', () => {
    const commands = parsePath(createArcPath({ ...base, innerRadius: 5, startAngle: 0, endAngle: 0.2, gap: 4 }));

    expect(commands.map((command) => command.type)).toEqual(['M', 'A', 'L', 'Z']);
  });
});

describe('createArcPoint', () => {
  it('measures angles clockwise from 12 o’clock', () => {
    const at = (angle: number) => {
      const point = createArcPoint({ x: 0, y: 0 }, { radius: 10, angle });

      return [Math.round(point.x) + 0, Math.round(point.y) + 0];
    };

    expect(at(0)).toEqual([0, -10]);
    expect(at(TAU / 4)).toEqual([10, 0]);
    expect(at(TAU / 2)).toEqual([0, 10]);
    expect(at(TAU * 0.75)).toEqual([-10, 0]);
  });
});

describe('placementForAngle', () => {
  it('opens the tooltip on the side of the circle the angle points to', () => {
    const degrees = [0, 30, 44.9, 45, 90, 134.9, 135, 180, 224.9, 225, 270, 314.9, 315, 359];

    expect(degrees.map((degree) => placementForAngle((degree / 180) * Math.PI))).toEqual([
      'top',
      'top',
      'top',
      'right',
      'right',
      'right',
      'bottom',
      'bottom',
      'bottom',
      'left',
      'left',
      'left',
      'top',
      'top',
    ]);
  });

  it('wraps angles outside one turn', () => {
    expect(placementForAngle(TAU + TAU / 4)).toBe('right');
    expect(placementForAngle(-TAU / 4)).toBe('left');
  });
});

describe('createWholePercentages', () => {
  it('rounds by the largest remainder, so the shares always add up to 100', () => {
    const percents = createWholePercentages([1, 1, 1]);

    expect(percents).toEqual([34, 33, 33]);
    expect(percents.reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it('keeps exact shares exact', () => {
    expect(createWholePercentages([50, 25, 25])).toEqual([50, 25, 25]);
  });

  it('gives the rounding remainder to the largest remainders, not the largest values', () => {
    expect(createWholePercentages([66.6, 16.7, 16.7])).toEqual([66, 17, 17]);
  });

  it('adds up to 100 over many small shares', () => {
    const values = [4200, 2600, 1800, 900, 520, 310, 140, 90];

    expect(createWholePercentages(values).reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it('gives zero, negative and non-finite values a share of 0', () => {
    expect(createWholePercentages([30, 0, -10, Number.NaN, 10])).toEqual([75, 0, 0, 0, 25]);
  });

  it('returns all zeros when nothing is positive', () => {
    expect(createWholePercentages([0, 0])).toEqual([0, 0]);
    expect(createWholePercentages([])).toEqual([]);
  });
});
