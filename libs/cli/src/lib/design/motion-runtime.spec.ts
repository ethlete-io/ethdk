// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Motion } from '../../../design/define-part';
import {
  manualClock,
  realTimeClock,
  runRules,
  seededRandom,
  stepMotion,
  switchState,
} from '../../../design/motion-runtime';

const states: Record<string, string> = {
  closed: '<div class="card"><button class="open">open</button></div>',
  open: '<div class="card card--open"><button class="close">close</button><p class="body">body</p></div>',
};

const mount = () => {
  const root = document.createElement('div');

  root.innerHTML = states['closed'] ?? '';
  document.body.replaceChildren(root);

  return root;
};

const settle = () => new Promise((done) => setTimeout(done, 0));

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'startViewTransition');
});

describe('runRules', () => {
  it('morphs to the rule state on a matching click and keeps the existing nodes', async () => {
    const root = mount();
    const card = root.querySelector('.card');

    runRules(root, {
      state: 'closed',
      rules: [{ on: 'click .open', to: 'open' }],
      render: (state) => states[state] ?? '',
    });
    root.querySelector<HTMLElement>('.open')?.click();
    await settle();

    expect(root.querySelector('.card')).toBe(card);
    expect(card?.className).toBe('card card--open');
    expect(root.querySelector('.body')?.textContent).toBe('body');
  });

  it('runs the named motion after the morph, with ctx.rect measured before it and ctx.at on the clock', async () => {
    const root = mount();
    const clock = manualClock();
    const seen: string[] = [];

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return { width: this.classList.contains('card--open') ? 300 : 100 } as DOMRect;
    });

    const fold: Motion = {
      from: 'closed',
      to: 'open',
      play: (ctx) => {
        seen.push(`rect ${ctx.rect('.card').width}`, `body ${root.querySelector('.body') ? 'in' : 'out'}`);
        ctx.at(200, () => seen.push(`at ${clock.now()}`));
      },
    };

    runRules(root, {
      state: 'closed',
      rules: [{ on: 'click .open', to: 'open', motion: 'fold' }],
      motions: { fold },
      render: (state) => states[state] ?? '',
      clock: () => clock,
    });
    root.querySelector<HTMLElement>('.open')?.click();
    await settle();

    expect(seen).toEqual(['rect 100', 'body in']);
    clock.advance(199);
    expect(seen).toHaveLength(2);
    clock.advance(1);
    expect(seen).toEqual(['rect 100', 'body in', 'at 200']);
  });

  it('switches without play when the rule names no motion', async () => {
    const root = mount();
    const play = vi.fn();

    runRules(root, {
      state: 'closed',
      rules: [{ on: 'click .open', to: 'open' }],
      motions: { fold: { from: 'closed', to: 'open', play } },
      render: (state) => states[state] ?? '',
    });
    root.querySelector<HTMLElement>('.open')?.click();
    await settle();

    expect(root.querySelector('.body')).not.toBeNull();
    expect(play).not.toHaveBeenCalled();
  });
});

describe('switchState', () => {
  it('runs a viewTransition motion inside document.startViewTransition', async () => {
    const root = mount();
    const startViewTransition = vi.fn((update: () => void) => {
      update();

      return { updateCallbackDone: Promise.resolve() };
    });

    Object.assign(document, { startViewTransition });
    await switchState({
      root,
      markup: states['open'] ?? '',
      motion: { from: 'closed', to: 'open', viewTransition: true },
    });

    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(root.querySelector('.body')).not.toBeNull();
  });

  it('morphs without a View Transition where the browser has none', async () => {
    const root = mount();

    await switchState({
      root,
      markup: states['open'] ?? '',
      motion: { from: 'closed', to: 'open', viewTransition: true },
    });

    expect(root.querySelector('.body')).not.toBeNull();
  });

  it('names a ctx.rect selector that matches nothing in the from state', () => {
    const root = mount();

    expect(() =>
      switchState({
        root,
        markup: states['open'] ?? '',
        motion: { from: 'closed', to: 'open', play: (ctx) => ctx.rect('.body') },
      }),
    ).toThrow('ctx.rect(".body")');
  });
});

describe('stepMotion', () => {
  const fakeAnimation = (keyframes: Keyframe[], duration: number) => {
    const timing = { delay: 0, duration, iterations: 1, endTime: duration };

    return {
      currentTime: null as number | null,
      pause: vi.fn(),
      effect: {
        target: document.querySelector('.card'),
        pseudoElement: null,
        getComputedTiming: () => timing,
        getTiming: () => ({ easing: 'ease-out' }),
        getKeyframes: () => keyframes,
      },
    };
  };

  it('pauses each animation and seeks it from the clock time it started at, also one a ctx.at step starts', async () => {
    const root = mount();
    const running: ReturnType<typeof fakeAnimation>[] = [];
    const late = fakeAnimation([{ backgroundColor: 'red' }], 300);

    Object.assign(document, { getAnimations: () => running });

    const stepped = await stepMotion({
      root,
      markup: states['open'] ?? '',
      motion: {
        from: 'closed',
        to: 'open',
        play: (ctx) => {
          running.push(fakeAnimation([{ transform: 'scale(1)' }], 400));
          ctx.at(500, () => running.push(late));
        },
      },
    });
    const [first] = running;

    expect(first?.pause).toHaveBeenCalledOnce();
    stepped.seek(200);
    expect(first?.currentTime).toBe(200);
    expect(running).toHaveLength(1);
    stepped.seek(650);
    expect(late.pause).toHaveBeenCalledOnce();
    expect([first?.currentTime, late.currentTime]).toEqual([650, 150]);
    expect(stepped.end()).toBe(800);
    expect(stepped.tracks().map(({ properties, start, easing }) => ({ properties, start, easing }))).toEqual([
      { properties: ['transform'], start: 0, easing: 'ease-out' },
      { properties: ['background-color'], start: 500, easing: 'ease-out' },
    ]);
    expect(() => stepped.seek(100)).toThrow('steps forward only');
    Reflect.deleteProperty(document, 'getAnimations');
  });

  it('names an element by its data-et-key, otherwise by its selector', async () => {
    const root = mount();
    const running: ReturnType<typeof fakeAnimation>[] = [];

    Object.assign(document, { getAnimations: () => running });

    const stepped = await stepMotion({
      root,
      markup: states['open'] ?? '',
      motion: {
        from: 'closed',
        to: 'open',
        play: () => {
          const card = document.querySelector('.card');
          const body = document.querySelector('.body');

          card?.setAttribute('data-et-key', 'card');
          running.push(fakeAnimation([{ opacity: 0 }], 100));
          running.push({
            ...fakeAnimation([{ opacity: 0 }], 100),
            effect: { ...fakeAnimation([], 1).effect, target: body },
          });
        },
      },
    });

    expect(stepped.tracks().map((track) => track.element)).toEqual(['[data-et-key="card"]', 'p.body']);
    Reflect.deleteProperty(document, 'getAnimations');
  });

  it('bounds the root and every animated element, ignoring one without a box', async () => {
    const root = mount();
    const running: ReturnType<typeof fakeAnimation>[] = [];
    const box = (left: number, top: number, right: number, bottom: number) =>
      ({ left, top, right, bottom, width: right - left, height: bottom - top }) as DOMRect;

    Object.assign(document, { getAnimations: () => running });

    const stepped = await stepMotion({
      root,
      markup: states['open'] ?? '',
      motion: {
        from: 'closed',
        to: 'open',
        play: () => {
          const boxless = fakeAnimation([], 100);

          running.push(fakeAnimation([{ transform: 'scale(2)' }], 100), boxless);
          boxless.effect.target = document.querySelector('.body');
        },
      },
    });

    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(box(5, 0, 70, 50));
    vi.spyOn(document.querySelector('.card') as Element, 'getBoundingClientRect').mockReturnValue(
      box(10, -20, 130, 40),
    );
    expect(stepped.bounds()).toEqual({ left: 5, top: -20, right: 130, bottom: 50 });
    Reflect.deleteProperty(document, 'getAnimations');
  });

  it('switches back at interrupt with the reverse motion, ends what it cancels and drops later forward steps', async () => {
    const root = mount();
    const running: (ReturnType<typeof fakeAnimation> & { playState?: string })[] = [];
    const forward = fakeAnimation([{ width: '300px' }], 1000);
    const back = fakeAnimation([{ width: '100px' }], 400);
    const settleBack = fakeAnimation([{ opacity: 1 }], 100);
    const dropped = fakeAnimation([{ color: 'red' }], 100);

    Object.assign(document, { getAnimations: () => running });

    const stepped = await stepMotion({
      root,
      markup: states['open'] ?? '',
      motion: {
        from: 'closed',
        to: 'open',
        interrupt: 200,
        play: (ctx) => {
          running.push(forward);
          ctx.at(300, () => running.push(dropped));
        },
      },
      reverse: {
        markup: states['closed'] ?? '',
        motion: {
          from: 'open',
          to: 'closed',
          play: (ctx) => {
            running.splice(0, running.length, back);
            Object.assign(forward, { playState: 'idle' });
            ctx.at(100, () => running.push(settleBack));
          },
        },
      },
    });

    stepped.seek(150);
    expect(root.querySelector('.card')?.className).toBe('card card--open');
    stepped.seek(500);
    expect(root.querySelector('.card')?.className).toBe('card');
    expect([forward.currentTime, back.currentTime, settleBack.currentTime]).toEqual([200, 300, 200]);
    expect(running).not.toContain(dropped);
    expect(stepped.tracks().map(({ properties, start, end }) => ({ properties, start, end }))).toEqual([
      { properties: ['width'], start: 0, end: 200 },
      { properties: ['width'], start: 200, end: 600 },
      { properties: ['opacity'], start: 300, end: 400 },
    ]);
    expect(stepped.end()).toBe(600);
    Reflect.deleteProperty(document, 'getAnimations');
  });

  it('needs the from markup for a motion with interrupt', () => {
    expect(() =>
      stepMotion({
        root: mount(),
        markup: states['open'] ?? '',
        motion: { from: 'closed', to: 'open', interrupt: 100 },
      }),
    ).toThrow('interrupt needs the markup');
  });
});

describe('clocks and random', () => {
  it('runs due tasks in time order as the manual clock advances', () => {
    const clock = manualClock();
    const order: number[] = [];

    clock.at(300, () => order.push(300));
    clock.at(100, () => {
      order.push(100);
      clock.at(150, () => order.push(150));
    });
    clock.advance(200);
    expect(order).toEqual([100, 150]);
    clock.advance(100);
    expect(order).toEqual([100, 150, 300]);
  });

  it('follows real time frame by frame while it has work', () => {
    const frames: (() => void)[] = [];
    let wall = 0;
    const clock = realTimeClock(
      (step) => frames.push(step),
      () => wall,
    );
    const done = vi.fn();

    clock.at(50, done);
    wall = 30;
    frames.shift()?.();
    expect(done).not.toHaveBeenCalled();
    wall = 60;
    frames.shift()?.();
    expect(done).toHaveBeenCalledOnce();
    expect(frames).toHaveLength(0);
  });

  it('gives the same sequence for the same seed', () => {
    const first = seededRandom();
    const second = seededRandom();
    const values = [first(), first(), first()];

    expect([second(), second(), second()]).toEqual(values);
    expect(new Set(values).size).toBe(3);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});
