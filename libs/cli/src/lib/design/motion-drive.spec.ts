// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  MotionDriveReply,
  createMotionDriver,
  emulateReducedMotion,
  motionDriveMessageOf,
} from '../../../design/motion-drive';
import type { SteppedMotion } from '../../../design/motion-runtime';

type FakeAnimation = {
  currentTime: number;
  playbackRate: number;
  playState: 'running' | 'paused' | 'finished';
  end: number;
  pause: () => void;
  play: () => void;
  finish: () => void;
  effect: { getComputedTiming: () => { endTime: number } };
};

const animationOf = (currentTime: number, end: number): FakeAnimation => {
  const animation: FakeAnimation = {
    currentTime,
    playbackRate: 1,
    playState: 'running',
    end,
    pause: () => {
      animation.playState = 'paused';
    },
    play: () => {
      animation.playState = 'running';
    },
    finish: () => {
      animation.playState = 'finished';
      animation.currentTime = end;
    },
    effect: { getComputedTiming: () => ({ endTime: end }) },
  };

  return animation;
};

const steppedOf = (animations: FakeAnimation[]) => {
  let now = 0;
  let released = false;

  return {
    seek: (ms: number) => {
      if (ms < now) throw new Error('forward only');
      now = ms;
      if (!released) for (const animation of animations) animation.currentTime = ms;
    },
    now: () => now,
    release: () => {
      released = true;
    },
    tracks: () => [],
    end: () => 1000,
    bounds: () => ({ left: 0, top: 0, right: 0, bottom: 0 }),
  } satisfies SteppedMotion;
};

const setup = () => {
  const animations = [animationOf(0, 1000), animationOf(0, 400)];
  const frames: ((time: number) => void)[] = [];
  const replies: MotionDriveReply[] = [];
  const start = vi.fn(() => Promise.resolve(steppedOf(animations)));
  const released = vi.fn();
  const fakeDocument = { getAnimations: () => animations } as unknown as Document;
  const driver = createMotionDriver({
    document: fakeDocument,
    start,
    released,
    reply: (reply) => replies.push(reply),
    frame: (step) => frames.push(step),
  });
  const tick = (time: number) => frames.splice(0).forEach((step) => step(time));

  return { animations, driver, replies, start, released, tick };
};

describe('motionDriveMessageOf', () => {
  it('reads the drive messages and drops anything else', () => {
    expect(motionDriveMessageOf({ type: 'design-explore:motion-start', motion: 'grow', reduced: true })).toEqual({
      type: 'design-explore:motion-start',
      motion: 'grow',
      reduced: true,
    });
    expect(motionDriveMessageOf({ type: 'design-explore:motion-seek', ms: 200, rate: 0.5 })).toEqual({
      type: 'design-explore:motion-seek',
      ms: 200,
      rate: 0.5,
    });
    expect(motionDriveMessageOf({ type: 'design-explore:motion-seek', ms: -1, rate: 1 })).toBeNull();
    expect(motionDriveMessageOf({ type: 'design-explore:motion-play', ms: 0, rate: 0 })).toBeNull();
    expect(motionDriveMessageOf({ type: 'design-explore:height' })).toBeNull();
  });
});

describe('createMotionDriver', () => {
  it('starts the motion and answers ready', async () => {
    const { driver, replies, start } = setup();

    await driver.handle({ type: 'design-explore:motion-start', motion: 'grow', reduced: true });

    expect(start).toHaveBeenCalledWith('grow', true);
    expect(replies).toEqual([{ type: 'design-explore:motion-ready', motion: 'grow' }]);
  });

  it('answers failed when the motion cannot start', async () => {
    const { driver, replies, start } = setup();

    start.mockReturnValueOnce(Promise.reject(new Error('no motion "grow"')));
    await driver.handle({ type: 'design-explore:motion-start', motion: 'grow', reduced: false });

    expect(replies).toEqual([{ type: 'design-explore:motion-failed', motion: 'grow', error: 'no motion "grow"' }]);
  });

  it('pauses every animation at the slider time with the speed as its rate', async () => {
    const { animations, driver } = setup();

    await driver.handle({ type: 'design-explore:motion-start', motion: 'grow', reduced: false });
    await driver.handle({ type: 'design-explore:motion-seek', ms: 300, rate: 0.25 });

    expect(animations.map((animation) => [animation.playState, animation.currentTime, animation.playbackRate])).toEqual(
      [
        ['paused', 300, 0.25],
        ['paused', 300, 0.25],
      ],
    );
  });

  it('restarts the motion to seek back', async () => {
    const { animations, driver, start } = setup();

    await driver.handle({ type: 'design-explore:motion-start', motion: 'grow', reduced: false });
    await driver.handle({ type: 'design-explore:motion-seek', ms: 600, rate: 1 });
    await driver.handle({ type: 'design-explore:motion-seek', ms: 100, rate: 1 });

    expect(start).toHaveBeenCalledTimes(2);
    expect(animations[0]?.currentTime).toBe(100);
  });

  it('plays the clock at the speed', async () => {
    const { animations, driver, tick } = setup();

    await driver.handle({ type: 'design-explore:motion-start', motion: 'grow', reduced: false });
    await driver.handle({ type: 'design-explore:motion-play', ms: 100, rate: 0.5 });
    tick(1000);
    tick(1200);

    expect(animations[0]?.currentTime).toBe(200);
    expect(animations[0]?.playbackRate).toBe(0.5);
  });

  it('stops the play loop on a seek', async () => {
    const { animations, driver, tick } = setup();

    await driver.handle({ type: 'design-explore:motion-start', motion: 'grow', reduced: false });
    await driver.handle({ type: 'design-explore:motion-play', ms: 0, rate: 1 });
    tick(0);
    await driver.handle({ type: 'design-explore:motion-seek', ms: 50, rate: 1 });
    tick(500);

    expect(animations[0]?.currentTime).toBe(50);
  });

  it('resumes every animation at 1x on stop and finishes the ones past their end', async () => {
    const { animations, driver, released } = setup();

    await driver.handle({ type: 'design-explore:motion-start', motion: 'grow', reduced: false });
    await driver.handle({ type: 'design-explore:motion-seek', ms: 500, rate: 0.1 });
    await driver.handle({ type: 'design-explore:motion-stop' });

    expect(animations.map((animation) => [animation.playState, animation.playbackRate])).toEqual([
      ['running', 1],
      ['finished', 1],
    ]);
    expect(released).toHaveBeenCalledOnce();
  });
});

describe('emulateReducedMotion', () => {
  const mediaOf = () => {
    const style = document.createElement('style');

    style.textContent =
      '@media (prefers-reduced-motion: reduce) { .a { color: red; } } @media (prefers-reduced-motion: no-preference) { .b { color: red; } } @media (min-width: 10px) { .c { color: red; } }';
    document.head.replaceChildren(style);

    return () => [...(style.sheet?.cssRules ?? [])].map((rule) => (rule as CSSMediaRule).media.mediaText);
  };

  it('makes the reduced rules match and puts them back', () => {
    const media = mediaOf();
    const restore = emulateReducedMotion(document, true);

    expect(media()).toEqual(['(min-width: 0px)', '(max-width: -1px)', '(min-width: 10px)']);

    restore();

    expect(media()).toEqual([
      '(prefers-reduced-motion: reduce)',
      '(prefers-reduced-motion: no-preference)',
      '(min-width: 10px)',
    ]);
  });

  it('makes the full-motion rules match without reduced motion', () => {
    const media = mediaOf();

    emulateReducedMotion(document, false);

    expect(media().slice(0, 2)).toEqual(['(max-width: -1px)', '(min-width: 0px)']);
  });
});
