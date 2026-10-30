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

/**
 * What a switch of `root` to `markup` does: `motion` names its `play` and `viewTransition`, `clock` the time `ctx.at`
 * runs on, and `transitioned` hears the View Transition when one starts.
 */
export type StateSwitch = {
  root: Element;
  markup: string;
  motion?: Motion;
  clock?: MotionClock;
  transitioned?: (transition: ViewTransition) => void;
};

/**
 * Morphs `root` to `markup`, inside a View Transition when the motion asks for one and the browser has it, then runs
 * the motion's `play`. `ctx.rect` measures in the DOM before the morph. Resolves once `play` has run.
 */
export const switchState = ({ root, markup, motion, clock, transitioned }: StateSwitch): Promise<void> => {
  const rect = motion?.play ? measure(root) : null;
  const apply = () => morph(root, markup);
  const play = () => {
    if (!motion?.play || !rect) return;

    const time = clock ?? realTimeClock();
    const ctx: MotionContext = { at: (ms, fn) => time.at(ms, fn), random: seededRandom(), rect };

    motion.play(ctx);
  };
  const document = root.ownerDocument;

  if (motion?.viewTransition && typeof document.startViewTransition === 'function') {
    const transition = document.startViewTransition(apply);

    transitioned?.(transition);

    return transition.updateCallbackDone.then(play);
  }

  apply();
  play();

  return Promise.resolve();
};

/** One animation of a motion, in ms from the start of the motion. `iterations` and `end` are `null` when it never ends. */
export type MotionTrack = {
  element: string;
  kind: 'transition' | 'animation' | 'script';
  name?: string;
  properties: string[];
  start: number;
  delay: number;
  duration: number;
  iterations: number | null;
  easing: string;
  end: number | null;
};

/** A motion paused at its start: `seek` moves it forward to a time in ms, `tracks` lists what ran so far. */
export type SteppedMotion = {
  seek: (ms: number) => void;
  tracks: () => MotionTrack[];
  end: () => number;
  bounds: () => MotionBox;
};

/** A rectangle in page coordinates. */
export type MotionBox = { left: number; top: number; right: number; bottom: number };

const KEYFRAME_FIELDS = new Set(['offset', 'computedOffset', 'easing', 'composite']);

const elementOf = (element: Element | null | undefined) =>
  element?.hasAttribute('data-et-key')
    ? `[data-et-key="${element.getAttribute('data-et-key')}"]`
    : element
      ? [
          element.tagName.toLowerCase(),
          element.id ? `#${element.id}` : '',
          ...[...element.classList].map((name) => `.${name}`),
        ].join('')
      : '';

const trackOf = (animation: Animation, start: number): MotionTrack => {
  const effect = animation.effect as KeyframeEffect | null;
  const timing = effect?.getComputedTiming();
  const keyframes = effect && typeof effect.getKeyframes === 'function' ? effect.getKeyframes() : [];
  const own = effect?.getTiming().easing ?? 'linear';
  const keyed = keyframes.find((frame) => frame.easing && frame.easing !== 'linear')?.easing;
  const iterations = timing?.iterations ?? 1;
  const endTime = Number(timing?.endTime ?? 0);
  const properties = [
    ...new Set(
      keyframes.flatMap((frame) =>
        Object.keys(frame)
          .filter((field) => !KEYFRAME_FIELDS.has(field))
          .map((field) => field.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)),
      ),
    ),
  ];
  const kind = 'transitionProperty' in animation ? 'transition' : 'animationName' in animation ? 'animation' : 'script';

  return {
    element: `${elementOf(effect?.target)}${effect?.pseudoElement ?? ''}`,
    kind,
    ...(kind === 'animation' ? { name: String((animation as CSSAnimation).animationName) } : {}),
    properties: kind === 'transition' ? [String((animation as CSSTransition).transitionProperty)] : properties,
    start,
    delay: Number(timing?.delay ?? 0),
    duration: Number(timing?.duration ?? 0),
    iterations: Number.isFinite(iterations) ? iterations : null,
    easing: own === 'linear' ? (keyed ?? own) : own,
    end: Number.isFinite(endTime) ? start + endTime : null,
  };
};

/**
 * Switches `root` to `markup` with `motion` as `switchState` does, on a manual clock, and pauses every animation it
 * starts, so a caller can step through the motion and draw it at any time from its start.
 */
export const stepMotion = (options: { root: Element; markup: string; motion: Motion }): Promise<SteppedMotion> => {
  const { root, markup, motion } = options;
  const document = root.ownerDocument;
  const clock = manualClock();
  const started = new Map<Animation, MotionTrack>();
  let lastTask = 0;
  let ready: Promise<unknown> = Promise.resolve();

  const collect = (start: number) => {
    for (const animation of document.getAnimations()) {
      if (started.has(animation)) continue;

      animation.pause();
      started.set(animation, trackOf(animation, start));
    }
  };

  const timed: MotionClock = {
    ...clock,
    at: (ms, fn) =>
      clock.at(ms, () => {
        lastTask = Math.max(lastTask, ms);
        fn();
        collect(ms);
      }),
  };

  return switchState({
    root,
    markup,
    motion,
    clock: timed,
    transitioned: (transition) => {
      ready = transition.ready.catch(() => undefined);
    },
  })
    .then(() => ready)
    .then(() => {
      collect(0);

      return {
        seek: (ms) => {
          if (ms < clock.now())
            throw new Error(`design-explore: a motion steps forward only, from ${clock.now()} ms to ${ms} ms`);

          clock.advance(ms - clock.now());

          for (const [animation, track] of started) animation.currentTime = ms - track.start;
        },
        tracks: () => [...started.values()],
        end: () => Math.max(lastTask, ...[...started.values()].map((track) => track.end ?? 0)),
        bounds: () => {
          const view = document.defaultView;
          const boxes = [
            root,
            ...[...started.keys()].map((animation) => (animation.effect as KeyframeEffect | null)?.target),
          ]
            .filter((element): element is Element => !!element)
            .map((element) => element.getBoundingClientRect())
            .filter((rect, index) => index === 0 || rect.width > 0 || rect.height > 0);

          return {
            left: Math.min(...boxes.map((rect) => rect.left)) + (view?.scrollX ?? 0),
            top: Math.min(...boxes.map((rect) => rect.top)) + (view?.scrollY ?? 0),
            right: Math.max(...boxes.map((rect) => rect.right)) + (view?.scrollX ?? 0),
            bottom: Math.max(...boxes.map((rect) => rect.bottom)) + (view?.scrollY ?? 0),
          };
        },
      };
    });
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
