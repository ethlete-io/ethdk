// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { MotionTrack } from '../../../design/motion-runtime';
import { normalisedEasingOf, rootTokensOf, withTokenNames } from '../../../design/motion-tokens';
import { spring } from '../../../design/spring';

const TRACK: MotionTrack = {
  element: '.panel',
  kind: 'transition',
  properties: ['opacity'],
  start: 0,
  delay: 0,
  duration: 150,
  iterations: 1,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  end: 150,
};

describe('withTokenNames', () => {
  it('matches a duration in ms or s and an easing in any spacing', () => {
    expect(
      withTokenNames(TRACK, [
        { name: '--duration-slow', value: '300ms' },
        { name: '--duration-fast', value: '0.15s' },
        { name: '--ease-emphasis', value: 'cubic-bezier(.2,0,0,1)' },
      ]),
    ).toEqual({ ...TRACK, durationTokens: ['--duration-fast'], easingTokens: ['--ease-emphasis'] });
  });

  it('keeps every token that shares the value, in declaration order', () => {
    const named = withTokenNames({ ...TRACK, duration: 120, easing: 'ease' }, [
      { name: '--duration-state', value: '120ms' },
      { name: '--ease-standard', value: 'ease' },
      { name: '--duration-appear', value: '0.12s' },
      { name: '--ease-classic', value: 'cubic-bezier(0.25, 0.1, 0.25, 1)' },
    ]);

    expect(named.durationTokens).toEqual(['--duration-state', '--duration-appear']);
    expect(named.easingTokens).toEqual(['--ease-standard', '--ease-classic']);
  });

  it('reads the duration and the easing of a spring() token', () => {
    const capsule = spring({ damping: 0.6, frequency: 2 });
    const spaced = capsule.easing.replace(/, /gu, ' ,  ');

    expect(
      withTokenNames({ ...TRACK, duration: capsule.duration, easing: capsule.easing }, [
        { name: '--motion-capsule', value: `${capsule.duration}ms ${spaced}` },
      ]),
    ).toEqual({
      ...TRACK,
      duration: capsule.duration,
      easing: capsule.easing,
      durationTokens: ['--motion-capsule'],
      easingTokens: ['--motion-capsule'],
    });
  });

  it('leaves the fields out without a match, and ignores tokens that are no time or easing', () => {
    const named = withTokenNames(TRACK, [
      { name: '--duration-slow', value: '300ms' },
      { name: '--transition-state', value: 'opacity 150ms cubic-bezier(0.2, 0, 0, 1)' },
      { name: '--space-3', value: '150px' },
    ]);

    expect(named).toEqual(TRACK);
    expect('durationTokens' in named || 'easingTokens' in named).toBe(false);
  });
});

describe('normalisedEasingOf', () => {
  it('fills in the omitted inputs of linear()', () => {
    expect(normalisedEasingOf('linear(0, 0.5, 1)')).toBe(normalisedEasingOf('linear(0 0%, 0.5 50%, 1 100%)'));
    expect(normalisedEasingOf('linear(0, 0.25 25% 75%, 1)')).toBe('linear(0 0%,0.25 25%,0.25 75%,1 100%)');
  });

  it('is null for what is no easing', () => {
    expect(normalisedEasingOf('120ms')).toBeNull();
    expect(normalisedEasingOf('cubic-bezier(1, 2)')).toBeNull();
  });
});

describe('rootTokensOf', () => {
  it('lists the custom properties of :root in declaration order', () => {
    const style = document.createElement('style');

    style.textContent = ':root { --ease-standard: ease; --duration-state: 120ms; color: red; } .x { --other: 1s; }';
    document.head.append(style);

    expect(rootTokensOf(document).map((token) => token.name)).toEqual(['--ease-standard', '--duration-state']);

    style.remove();
  });
});
