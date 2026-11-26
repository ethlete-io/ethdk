/** A design mock held at `at` of its `--<block>-duration`, as `data-et-frozen-at` with `--<block>-frozen-at` draws it. */
export type FrozenAnimation = { block: string; at: number };

const FROZEN_TAG = /<[a-z][\w-]*\s[^>]*\bdata-et-frozen-at\b[^>]*>/gi;

/** The mocks a design picture's markup holds at one frame, in document order. */
export const frozenAnimationsOf = (markup: string): FrozenAnimation[] =>
  [...markup.matchAll(FROZEN_TAG)].flatMap(([tag]) => {
    const held = tag.match(/--([\w-]+)-frozen-at:\s*(-?[\d.]+)/);
    const block = held?.[1];
    const at = Number(held?.[2]);

    if (!block || !Number.isFinite(at)) return [];

    const classes = tag.match(/\bclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];

    return classes.includes(block) ? [{ block, at }] : [];
  });

/**
 * A page script that holds every infinite animation inside the n-th `.<block>` element at the n-th frozen mock's time,
 * as the mock's paused `animation-delay` does, with a playback rate of 0 so a screenshot with disabled animations
 * keeps that frame instead of resetting it to the start.
 */
export const freezeAnimationsScriptOf = (frozen: FrozenAnimation[]) => `(() => {
  const frozen = ${JSON.stringify(frozen)};
  const msOf = (value) => {
    const time = value.trim().match(/^(-?[\\d.]+)(ms|s)$/);

    return time ? Number(time[1]) * (time[2] === 's' ? 1000 : 1) : null;
  };

  for (const block of new Set(frozen.map((mock) => mock.block))) {
    const mocks = frozen.filter((mock) => mock.block === block);

    document.querySelectorAll('.' + block).forEach((element, index) => {
      const { at } = mocks[Math.min(index, mocks.length - 1)];
      const style = getComputedStyle(element);
      const duration = msOf(style.getPropertyValue('--' + block + '-duration')) ?? msOf(style.getPropertyValue('--_' + block + '-duration'));

      for (const animation of element.getAnimations({ subtree: true })) {
        const timing = animation.effect?.getComputedTiming();

        if (!timing || timing.iterations !== Infinity) continue;

        animation.pause();
        animation.currentTime = at * (duration ?? Number(timing.duration)) + Number(timing.delay ?? 0);
        animation.playbackRate = 0;
      }
    });
  }
})()`;
