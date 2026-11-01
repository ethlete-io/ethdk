import { describe, expect, it } from 'vitest';
import {
  LiveControl,
  LiveOutcome,
  liveDriftOf,
  liveOutcomeOf,
  liveStateCompareOf,
  nearestControlOf,
} from './live-actions';

const control = (key: string, extra: Partial<LiveControl> = {}): LiveControl => ({
  key,
  occurrence: 0,
  probe: 0,
  action: null,
  control: null,
  x: 0,
  y: 0,
  expanded: null,
  current: null,
  overlay: false,
  parts: [],
  ...extra,
});

const OUTCOME: LiveOutcome = { emitted: ['sectionChange'], expanded: [], current: null, added: [], removed: [] };

const press = (page: string, outcome: Partial<LiveOutcome> = {}) => ({
  page,
  control: 'button "System"',
  action: 'emit:sectionChange',
  input: 'click' as const,
  outcome: { ...OUTCOME, ...outcome },
  parts: ['elements/shell-rail'],
});

describe('liveDriftOf', () => {
  it('fails once for a control whose outcome differs between pages, naming each page with the differing field', () => {
    const lines = liveDriftOf([
      press('pages/inbox', { current: 'button "System"=page' }),
      press('pages/flows', { current: 'button "System"=page' }),
      press('pages/sketches'),
    ]);

    expect(lines).toEqual([
      {
        page: 'drift',
        element: 'button "System"',
        input: 'click',
        parts: ['pages/flows', 'elements/shell-rail', 'pages/inbox', 'pages/sketches'],
        failure:
          'behaves differently per page: pages/flows: current button "System"=page | pages/inbox: current button "System"=page | pages/sketches: current unchanged',
      },
    ]);
  });

  it('passes a control that behaves the same on every page, and skips one pressed on a single page', () => {
    expect(liveDriftOf([press('pages/inbox'), press('pages/flows')]).map((line) => line.failure)).toEqual([null]);
    expect(liveDriftOf([press('pages/inbox')])).toEqual([]);
  });

  it('compares a control per declared action and input', () => {
    const lines = liveDriftOf([press('pages/inbox'), { ...press('pages/flows', { emitted: [] }), input: 'Enter' }]);

    expect(lines).toEqual([]);
  });
});

describe('liveOutcomeOf', () => {
  it('names only the controls that gained an aria-current, and the expanded ones after the press', () => {
    const before = [control('button "Inbox"', { current: 'page' }), control('button "System"')];
    const after = [
      control('button "Inbox"', { current: 'page' }),
      control('button "System"', { current: 'page', expanded: 'true' }),
    ];

    expect(liveOutcomeOf({ before, after, emitted: ['sectionChange', 'sectionChange'] })).toEqual({
      emitted: ['sectionChange'],
      expanded: ['button "System"'],
      current: 'button "System"=page',
      added: [],
      removed: [],
    });
  });

  it('names the controls a press added and removed, by occurrence', () => {
    const before = [control('menuitem "a"'), control('menuitem "a"', { occurrence: 1 })];
    const after = [control('menuitem "a"'), control('button "b"')];

    expect(liveOutcomeOf({ before, after, emitted: [] })).toEqual({
      emitted: [],
      expanded: [],
      current: null,
      added: ['button "b"'],
      removed: ['menuitem "a" (2.)'],
    });
  });
});

describe('liveStateCompareOf', () => {
  it('passes when every drawn aria-expanded control matches, and names each one that does not', () => {
    const after = [control('button "Projekt"', { expanded: 'true' })];

    expect(liveStateCompareOf({ state: 'open', expected: { 'button "Projekt"': 'true' }, after })).toEqual({
      ok: true,
      detail: '',
    });
    expect(
      liveStateCompareOf({
        state: 'closed',
        expected: { 'button "Projekt"': 'false', 'button "Menü"': 'false' },
        after,
      }),
    ).toEqual({
      ok: false,
      detail: 'button "Projekt" aria-expanded true, not false, button "Menü" aria-expanded absent, not false',
    });
  });

  it('fails a state that draws no aria-expanded control', () => {
    expect(liveStateCompareOf({ state: 'open', expected: {}, after: [] })).toEqual({
      ok: false,
      detail: 'state open draws no aria-expanded control, so a live page cannot tell it',
    });
  });
});

describe('nearestControlOf', () => {
  it('picks the design control of the same key nearest to the app control', () => {
    const app = { key: 'button "a"', x: 100, y: 100 };
    const design = [
      { key: 'button "a"', x: 0, y: 0 },
      { key: 'button "b"', x: 100, y: 100 },
      { key: 'button "a"', x: 110, y: 90 },
    ];

    expect(nearestControlOf(app, design)).toBe(design[2]);
    expect(nearestControlOf({ ...app, key: 'button "c"' }, design)).toBeNull();
  });
});
