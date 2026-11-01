import { describe, expect, it } from 'vitest';
import { focusMarkedOf, pointerFocusVerdictOf, RingProbe, RingStyle, ringVisibleOf } from './pointer-focus';

const none: RingStyle = {
  outlineStyle: 'none',
  outlineWidth: '0px',
  outlineColor: 'rgb(0, 0, 0)',
  boxShadow: 'none',
};
const ring: RingStyle = {
  outlineStyle: 'solid',
  outlineWidth: '2px',
  outlineColor: 'rgb(10, 20, 30)',
  boxShadow: 'none',
};
const hidden: RingStyle = { ...ring, outlineColor: 'rgba(0, 0, 0, 0)' };
const probeOf = (style: RingStyle, extra: Partial<RingProbe> = {}): RingProbe => ({
  style,
  focused: true,
  textEntry: false,
  ...extra,
});

describe('ringVisibleOf', () => {
  it('sees a solid opaque outline', () => expect(ringVisibleOf(ring)).toBe(true));
  it('ignores a missing outline', () => expect(ringVisibleOf(none)).toBe(false));
  it('ignores a transparent outline colour', () => {
    expect(ringVisibleOf(hidden)).toBe(false);
    expect(ringVisibleOf({ ...ring, outlineColor: 'rgb(0 0 0 / 0)' })).toBe(false);
    expect(ringVisibleOf({ ...ring, outlineColor: 'transparent' })).toBe(false);
  });
  it('ignores a zero width', () => expect(ringVisibleOf({ ...ring, outlineWidth: '0px' })).toBe(false));
  it('sees a semi-transparent outline', () =>
    expect(ringVisibleOf({ ...ring, outlineColor: 'rgba(0, 0, 0, 0.5)' })).toBe(true));
});

describe('focusMarkedOf', () => {
  it('accepts an outline', () => expect(focusMarkedOf({ before: none, after: ring })).toBe(true));
  it('accepts a changed box-shadow', () =>
    expect(focusMarkedOf({ before: none, after: { ...none, boxShadow: '0 0 0 2px red' } })).toBe(true));
  it('rejects an unchanged box-shadow', () =>
    expect(
      focusMarkedOf({
        before: { ...none, boxShadow: '0 0 0 2px red' },
        after: { ...none, boxShadow: '0 0 0 2px red' },
      }),
    ).toBe(false));
  it('rejects nothing drawn', () => expect(focusMarkedOf({ before: none, after: hidden })).toBe(false));
});

describe('pointerFocusVerdictOf', () => {
  const keyboard = { before: hidden, probe: probeOf(ring) };

  it('passes a click without ring and a keyboard ring', () =>
    expect(pointerFocusVerdictOf({ click: probeOf(hidden), keyboard })).toEqual({ failure: null, warning: null }));

  it('fails a ring after a click', () =>
    expect(pointerFocusVerdictOf({ click: probeOf(ring), keyboard }).failure).toContain('after a pointer click'));

  it('fails a ring that a Shift press after the click brings up', () =>
    expect(pointerFocusVerdictOf({ click: probeOf(hidden), clickThenKey: probeOf(ring), keyboard }).failure).toContain(
      'after a pointer click and a Shift press',
    ));

  it('passes a click that stays without ring after a Shift press', () =>
    expect(
      pointerFocusVerdictOf({ click: probeOf(hidden), clickThenKey: probeOf(hidden), keyboard }).failure,
    ).toBeNull());

  it('exempts text entry', () =>
    expect(pointerFocusVerdictOf({ click: probeOf(ring, { textEntry: true }), keyboard }).failure).toBeNull());

  it('ignores a ring on an element the click did not focus', () =>
    expect(pointerFocusVerdictOf({ click: probeOf(ring, { focused: false }), keyboard }).failure).toBeNull());

  it('warns when keyboard focus draws no ring', () =>
    expect(
      pointerFocusVerdictOf({ click: probeOf(hidden), keyboard: { before: hidden, probe: probeOf(hidden) } }).warning,
    ).toContain('no focus ring'));

  it('warns when keyboard focus fails', () =>
    expect(
      pointerFocusVerdictOf({
        click: probeOf(hidden),
        keyboard: { before: hidden, probe: probeOf(ring, { focused: false }) },
      }).warning,
    ).toContain('could not take'));
});
