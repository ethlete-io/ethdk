// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Motion } from '../../../design/define-part';
import { manualClock, realTimeClock, runRules, seededRandom, switchState } from '../../../design/motion-runtime';

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
