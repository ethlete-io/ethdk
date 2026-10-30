import { Motion, MotionContext, PartRule } from './define-part';
import { morph } from './morph';

/** The time of a motion in ms from its start: `at` runs `fn` once `now` reaches `ms`, `advance` moves time on. */
export type MotionClock = {
  now: () => number;
  at: (ms: number, fn: () => void) => void;
  advance: (ms: number) => void;
};

/** A clock that only moves when `advance` is called, so a caller can pause and step a motion. */
export const manualClock = (): MotionClock => {
  let time = 0;
  let queue: { ms: number; fn: () => void }[] = [];

  return {
    now: () => time,
    at: (ms, fn) => {
      queue.push({ ms, fn });
    },
    advance: (ms) => {
      const target = time + ms;

      for (;;) {
        const due = queue.reduce<{ ms: number; fn: () => void } | null>(
          (first, task) => (task.ms <= target && (!first || task.ms < first.ms) ? task : first),
          null,
        );

        if (!due) break;

        queue = queue.filter((task) => task !== due);
        time = Math.max(time, due.ms);
        due.fn();
      }

      time = target;
    },
  };
};

/** A clock that follows real time while it has work, one step per animation frame. */
export const realTimeClock = (
  frame: (step: () => void) => void = (step) => requestAnimationFrame(step),
  wall: () => number = () => performance.now(),
): MotionClock => {
  const clock = manualClock();
  let waiting = 0;
  let last: number | null = null;

  const tick = () => {
    const now = wall();

    clock.advance(now - (last ?? now));
    last = now;

    if (waiting > 0) frame(tick);
    else last = null;
  };

  return {
    ...clock,
    at: (ms, fn) => {
      waiting++;
      clock.at(ms, () => {
        waiting--;
        fn();
      });

      if (last === null) {
        last = wall();
        frame(tick);
      }
    },
  };
};

/** The same sequence in every run: mulberry32 from a fixed seed. */
export const seededRandom = (seed = 1) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const measure = (root: Element) => {
  const rects = [...root.querySelectorAll('*')].map((element) => element.getBoundingClientRect());
  const copy = root.cloneNode(true) as Element;
  const copies = [...copy.querySelectorAll('*')];

  return (selector: string) => {
    const found = copy.querySelector(selector);
    const rect = found ? rects[copies.indexOf(found)] : undefined;

    if (!rect) throw new Error(`design-explore: ctx.rect("${selector}") matches nothing in the from state`);

    return rect;
  };
};

/** What a switch of `root` to `markup` does: `motion` names its `play` and `viewTransition`, `clock` the time `ctx.at` runs on. */
export type StateSwitch = { root: Element; markup: string; motion?: Motion; clock?: MotionClock };

/**
 * Morphs `root` to `markup`, inside a View Transition when the motion asks for one and the browser has it, then runs
 * the motion's `play`. `ctx.rect` measures in the DOM before the morph. Resolves once `play` has run.
 */
export const switchState = ({ root, markup, motion, clock }: StateSwitch): Promise<void> => {
  const rect = motion?.play ? measure(root) : null;
  const apply = () => morph(root, markup);
  const play = () => {
    if (!motion?.play || !rect) return;

    const time = clock ?? realTimeClock();
    const ctx: MotionContext = { at: (ms, fn) => time.at(ms, fn), random: seededRandom(), rect };

    motion.play(ctx);
  };
  const document = root.ownerDocument;

  if (motion?.viewTransition && typeof document.startViewTransition === 'function')
    return document.startViewTransition(apply).updateCallbackDone.then(play);

  apply();
  play();

  return Promise.resolve();
};

/**
 * How `runRules` reaches the part: the state drawn first, its `rules` and `motions`, and the markup of a state. `clock`
 * makes the clock of each switch, `switched` hears each finished switch and `failed` each error.
 */
export type PartRules = {
  state: string;
  rules: PartRule[];
  motions?: Record<string, Motion>;
  render: (state: string) => string | Promise<string>;
  clock?: () => MotionClock;
  switched?: (state: string) => void;
  failed?: (error: unknown) => void;
};

/**
 * Runs the rules of a part in `root`: an event that matches a rule's `on`, such as `click .open`, morphs the part to the
 * rule's state with the motion it names. Switches run one after another. Returns a function that stops the rules.
 */
export const runRules = (root: HTMLElement, part: PartRules) => {
  let current = part.state;
  let queue = Promise.resolve();
  const types = [...new Set(part.rules.map((rule) => rule.on.trim().split(/\s+/u)[0] ?? ''))].filter(Boolean);

  const go = (rule: PartRule) => {
    queue = queue
      .then(() => (rule.to === current ? null : part.render(rule.to)))
      .then((markup) => {
        if (markup === null) return;

        current = rule.to;

        return switchState({
          root,
          markup,
          motion: rule.motion ? part.motions?.[rule.motion] : undefined,
          clock: part.clock?.(),
        }).then(() => part.switched?.(rule.to));
      })
      .catch((error: unknown) => (part.failed ?? console.error)(error));
  };

  const listener = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    const rule = part.rules.find((entry) => {
      const [type = '', ...rest] = entry.on.trim().split(/\s+/u);
      const selector = rest.join(' ');

      if (type !== event.type) return false;
      if (!selector) return true;

      const matched = target?.closest(selector);

      return matched ? root.contains(matched) : false;
    });

    if (rule) go(rule);
  };

  for (const type of types) root.addEventListener(type, listener);

  return () => {
    for (const type of types) root.removeEventListener(type, listener);
  };
};
