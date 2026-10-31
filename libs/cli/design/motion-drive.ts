import { SteppedMotion } from './motion-runtime';

/** What the Studio timeline posts into a live frame to drive a motion of its part. */
export type MotionDriveMessage =
  | { type: 'design-explore:motion-start'; motion: string; reduced: boolean }
  | { type: 'design-explore:motion-seek'; ms: number; rate: number }
  | { type: 'design-explore:motion-play'; ms: number; rate: number }
  | { type: 'design-explore:motion-stop' };

/** What a live frame posts back once a motion started, or failed to. */
export type MotionDriveReply =
  | { type: 'design-explore:motion-ready'; motion: string }
  | { type: 'design-explore:motion-failed'; motion: string; error: string };

const TAIL_MS = 30000;

const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isRate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** The drive message `data` holds, or `null` for any other message. */
export const motionDriveMessageOf = (data: unknown): MotionDriveMessage | null => {
  if (typeof data !== 'object' || data === null) return null;

  const message = data as Record<string, unknown>;

  switch (message['type']) {
    case 'design-explore:motion-start':
      return typeof message['motion'] === 'string'
        ? { type: message['type'], motion: message['motion'], reduced: message['reduced'] === true }
        : null;
    case 'design-explore:motion-seek':
    case 'design-explore:motion-play':
      return isTime(message['ms']) && isRate(message['rate'])
        ? { type: message['type'], ms: message['ms'], rate: message['rate'] }
        : null;
    case 'design-explore:motion-stop':
      return { type: message['type'] };
    default:
      return null;
  }
};

const REDUCED_FEATURE = /\(\s*prefers-reduced-motion\s*(?::\s*(reduce|no-preference)\s*)?\)/g;
const ALWAYS = '(min-width: 0px)';
const NEVER = '(max-width: -1px)';

type MediaHolder = CSSRule & { media: MediaList };

const mediaRulesOf = (rules: CSSRuleList): MediaHolder[] =>
  [...rules].flatMap((rule) =>
    'cssRules' in rule
      ? [...('media' in rule ? [rule as MediaHolder] : []), ...mediaRulesOf((rule as CSSGroupingRule).cssRules)]
      : [],
  );

const sheetRulesOf = (sheet: CSSStyleSheet) => {
  try {
    return mediaRulesOf(sheet.cssRules);
  } catch {
    return [];
  }
};

/**
 * Makes every `prefers-reduced-motion` media rule of `document` match as if the user asked for `reduced` motion, and
 * returns a function that puts the rules back. Scripts that call `matchMedia` still see the real preference.
 */
export const emulateReducedMotion = (document: Document, reduced: boolean) => {
  const changed = [...document.styleSheets].flatMap(sheetRulesOf).flatMap((rule) => {
    const original = rule.media.mediaText;
    const emulated = original.replace(REDUCED_FEATURE, (_, value?: string) =>
      (value === 'no-preference' ? !reduced : reduced) ? ALWAYS : NEVER,
    );

    if (emulated === original) return [];

    rule.media.mediaText = emulated;

    return [{ rule, original }];
  });

  return () => {
    for (const { rule, original } of changed) rule.media.mediaText = original;
  };
};

/**
 * Drives a motion in a live frame from drive messages: `start` (re)starts the motion from its `from` state, a seek
 * pauses every animation of the document at that time, play runs the motion's clock and animations at `rate`, and
 * stop resumes every animation at 1x. `released` hears each stop.
 */
export const createMotionDriver = (options: {
  document: Document;
  start: (motion: string, reduced: boolean) => Promise<SteppedMotion>;
  reply: (reply: MotionDriveReply) => void;
  released?: () => void;
  frame?: (step: (time: number) => void) => unknown;
}) => {
  const { document, reply } = options;
  const frame = options.frame ?? ((step: (time: number) => void) => requestAnimationFrame(step));
  let started: { motion: string; reduced: boolean } | null = null;
  let stepped: SteppedMotion | null = null;
  let loop = 0;
  let queue: Promise<void> = Promise.resolve();

  const holdAll = (rate: number) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.playbackRate = rate;
    }
  };

  const resumeAll = () => {
    for (const animation of document.getAnimations()) {
      const end = animation.effect?.getComputedTiming().endTime;

      animation.playbackRate = 1;

      if (typeof end === 'number' && Number.isFinite(end) && Number(animation.currentTime ?? 0) >= end)
        animation.finish();
      else animation.play();
    }
  };

  const run = (play: { motion: SteppedMotion; from: number; rate: number; step: () => void }) => {
    const { motion, rate, step } = play;
    const id = ++loop;
    let time = play.from;
    let last: number | null = null;

    const tick = (now: number) => {
      if (id !== loop) return;

      time += (now - (last ?? now)) * rate;
      last = now;
      motion.seek(Math.min(time, TAIL_MS));
      step();

      if (time < TAIL_MS) frame(tick);
    };

    frame(tick);
  };

  const moveTo = (ms: number): Promise<SteppedMotion | null> => {
    if (!stepped || !started) return Promise.resolve(null);
    if (ms >= stepped.now()) {
      stepped.seek(ms);

      return Promise.resolve(stepped);
    }

    return options.start(started.motion, started.reduced).then((restarted) => {
      stepped = restarted;
      restarted.seek(ms);

      return restarted;
    });
  };

  const handled = (message: MotionDriveMessage): Promise<void> => {
    loop++;

    switch (message.type) {
      case 'design-explore:motion-start':
        started = { motion: message.motion, reduced: message.reduced };
        stepped = null;

        return options.start(message.motion, message.reduced).then(
          (motion) => {
            stepped = motion;
            reply({ type: 'design-explore:motion-ready', motion: message.motion });
          },
          (error: unknown) =>
            reply({
              type: 'design-explore:motion-failed',
              motion: message.motion,
              error: error instanceof Error ? error.message : String(error),
            }),
        );
      case 'design-explore:motion-seek':
        return moveTo(message.ms).then((motion) => {
          if (motion) holdAll(message.rate);
        });
      case 'design-explore:motion-play':
        return moveTo(message.ms).then((motion) => {
          if (!motion) return;

          holdAll(message.rate);
          run({ motion, from: message.ms, rate: message.rate, step: () => holdAll(message.rate) });
        });
      case 'design-explore:motion-stop': {
        const motion = stepped;

        if (!motion) return Promise.resolve();

        motion.release();
        resumeAll();
        options.released?.();
        run({ motion, from: motion.now(), rate: 1, step: () => undefined });

        return Promise.resolve();
      }
    }
  };

  return {
    handle: (message: MotionDriveMessage) => {
      queue = queue.then(() => handled(message)).catch(() => undefined);

      return queue;
    },
  };
};
