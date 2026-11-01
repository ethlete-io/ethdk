import { answerFileOf, liveSpecProblemOf, mergedStorageOf, substitutedOf } from './live-compare';

const SPEC = {
  host: 'app-shell',
  pages: {
    'pages/home': {
      states: {
        edge: { design: 'part', pan: { selector: '.canvas > div', x: -200, y: 0 }, click: ['Hide panel'] },
      },
    },
  },
};

describe('liveSpecProblemOf', () => {
  it('accepts a spec with pages, states, pans and clicks', () => {
    expect(liveSpecProblemOf(SPEC)).toBeNull();
  });

  it('accepts frame content, page hosts, sample overrides and composed parts', () => {
    expect(
      liveSpecProblemOf({
        host: 'app-shell',
        frame: 'live/frame.png',
        pages: {
          'pages/start': {
            host: 'app-start',
            answers: { '/x': 'live/x.json' },
            states: {
              hidden: {
                design: 'part',
                invoke: { roots: [] },
                compose: { 'elements/shell': { panel: 'hidden' } },
              },
            },
          },
        },
      }),
    ).toBeNull();
  });

  it('accepts a fixed ISO time and rejects one that does not parse', () => {
    expect(liveSpecProblemOf({ ...SPEC, now: '2026-11-04T12:00:00Z' })).toBeNull();
    expect(liveSpecProblemOf({ ...SPEC, now: 'Mittwoch' })).toBe('now must be an ISO time');
  });

  it.each([
    [{ pages: {} }, 'a live spec must be'],
    [{ ...SPEC, answers: { '/x': 1 } }, 'answers must map'],
    [{ host: 'a', pages: { 'pages/home': {} } }, 'pages/home must have states'],
    [{ host: 'a', pages: { 'pages/home': { states: { edge: {} } } } }, 'must name its design state'],
    [{ host: 'a', pages: { 'pages/home': { states: { edge: { design: 'part', pan: { x: 1 } } } } } }, 'pan must be'],
    [{ host: 'a', pages: { 'pages/home': { states: { edge: { design: 'part', click: 'x' } } } } }, 'click must be'],
    [{ ...SPEC, frame: 1 }, 'frame must name a PNG'],
    [{ host: 'a', pages: { 'pages/home': { host: 1, states: {} } } }, 'host must be a selector'],
    [{ host: 'a', pages: { 'pages/home': { answers: { '/x': 1 }, states: {} } } }, 'pages/home: answers must map'],
    [{ host: 'a', pages: { 'pages/home': { states: { edge: { design: 'part', invoke: 1 } } } } }, 'invoke must be'],
    [
      { host: 'a', pages: { 'pages/home': { states: { edge: { design: 'part', compose: { x: 1 } } } } } },
      'compose must',
    ],
  ])('refuses %j', (spec, message) => {
    expect(liveSpecProblemOf(spec)).toContain(message);
  });
});

describe('mergedStorageOf', () => {
  it('merges object values per key and lets a later layer replace any other value', () => {
    expect(
      mergedStorageOf({ view: { checkout: '/a', cameras: { one: { x: 1 } } }, flag: 'old' }, undefined, {
        view: { cameras: { two: { x: 2 } } },
        flag: 'new',
      }),
    ).toEqual({ view: { checkout: '/a', cameras: { one: { x: 1 }, two: { x: 2 } } }, flag: 'new' });
  });
});

describe('substitutedOf', () => {
  it('replaces $port and $checkout anywhere in the value', () => {
    expect(substitutedOf({ a: '$port', b: ['$checkout', 'x'] }, { port: 4000, checkout: '/repo' })).toEqual({
      a: 4000,
      b: ['/repo', 'x'],
    });
  });
});

describe('answerFileOf', () => {
  it('prefers the answer of the path with its query over the path alone', () => {
    const answers = { '/__design/system': 'system.json', '/__design/flows?product=a': 'flows-a.json' };

    expect(answerFileOf(answers, new URL('http://localhost/__design/system?x=1'))).toBe('system.json');
    expect(answerFileOf(answers, new URL('http://localhost/__design/flows?product=a'))).toBe('flows-a.json');
    expect(answerFileOf(answers, new URL('http://localhost/__design/flows?product=b'))).toBeNull();
  });
});
