import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { MotionAnswer, MotionTrack, keyframeAt, trackBarOf } from '../../host/design-motion';
import { THEMES } from '../../themes';
import { MotionTimelineComponent } from './motion-timeline.component';

const TRACK: MotionTrack = {
  element: '[data-et-key="panel"]',
  kind: 'transition',
  properties: ['opacity', 'transform'],
  start: 100,
  delay: 0,
  duration: 200,
  iterations: 1,
  easing: 'ease-out',
  end: 300,
};

const ANSWER: MotionAnswer = {
  product: 'studio',
  part: 'components/drawer',
  motion: 'open',
  from: 'closed',
  to: 'open',
  mode: 'full',
  preset: 'phone',
  width: 390,
  end: 400,
  tracks: [
    TRACK,
    {
      ...TRACK,
      element: 'div.scrim',
      kind: 'animation',
      name: 'fade-in',
      properties: ['opacity'],
      start: 0,
      end: null,
    },
  ],
  keyframes: [0, 100, 200, 300, 400].map((ms) => ({ ms, src: `http://localhost:4999/k?frame=${ms}` })),
};

const settle = async (fixture: ComponentFixture<MotionTimelineComponent>) => {
  for (let round = 0; round < 3; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
};

const render = async (start: number) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(MotionTimelineComponent);

  fixture.componentRef.setInput('answer', ANSWER);
  fixture.componentRef.setInput('start', start);
  await settle(fixture);

  return { fixture, element: fixture.nativeElement as HTMLElement };
};

describe('keyframeAt', () => {
  it('takes the last keyframe at or before the time', () => {
    expect(keyframeAt(ANSWER.keyframes, 250)?.ms).toBe(200);
    expect(keyframeAt(ANSWER.keyframes, 300)?.ms).toBe(300);
    expect(keyframeAt(ANSWER.keyframes, -5)?.ms).toBe(0);
    expect(keyframeAt([], 10)).toBeNull();
  });
});

describe('trackBarOf', () => {
  it('places a track from its start plus delay to its end', () => {
    expect(trackBarOf(TRACK, 400)).toEqual({ left: 25, width: 50 });
    expect(trackBarOf({ ...TRACK, delay: 100 }, 400)).toEqual({ left: 50, width: 25 });
  });

  it('runs an infinite track to the end of the timeline', () => {
    expect(trackBarOf({ ...TRACK, start: 0, end: null }, 400)).toEqual({ left: 0, width: 100 });
  });
});

describe('MotionTimelineComponent', () => {
  it('shows the keyframe at the time it opens at, and one row per track', async () => {
    const { element } = await render(300);

    expect(element.querySelector('[data-motion-picture]')?.getAttribute('src')).toBe(
      'http://localhost:4999/k?frame=300',
    );
    expect(element.querySelector('[data-motion-time]')?.textContent?.trim()).toBe('300 / 400 ms');
    expect(
      [...element.querySelectorAll('[data-motion-track]')].map((row) => row.textContent?.replace(/\s+/gu, ' ').trim()),
    ).toEqual([
      '[data-et-key="panel"] opacity, transform, 200 ms, ease-out',
      'div.scrim fade-in: opacity, 200 ms, ease-out',
    ]);
  });

  it('marks the picked speed', async () => {
    const { element, fixture } = await render(0);
    const speeds = [...element.querySelectorAll<HTMLButtonElement>('[data-motion-speed]')];

    expect(speeds.map((speed) => speed.textContent?.trim())).toEqual(['0.1×', '0.25×', '0.5×', '1×']);

    speeds[1]?.click();
    await settle(fixture);

    expect(speeds.map((speed) => speed.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false']);
  });

  it('plays from the start again once it reached the end', async () => {
    const { element, fixture } = await render(400);
    const play = element.querySelector<HTMLButtonElement>('[data-motion-play]');

    play?.click();
    await settle(fixture);

    expect(play?.textContent?.trim()).toBe('Pause');
    expect(element.querySelector('[data-motion-picture]')?.getAttribute('src')).toBe('http://localhost:4999/k?frame=0');
  });
});
