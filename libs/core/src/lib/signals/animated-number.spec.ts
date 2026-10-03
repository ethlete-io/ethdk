import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { easeInOut, easeLinear, easeOut, signalAnimatedNumber, SignalAnimatedNumberOptions } from './animated-number';

describe('signalAnimatedNumber', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextId: number;
  let now: number;

  const flushFrame = (timestamp: number) => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((cb) => cb(timestamp));
  };

  const setup = (source: number | ReturnType<typeof signal<number>>, options?: SignalAnimatedNumberOptions) => {
    const injector = Injector.create({ providers: [], parent: TestBed.inject(Injector) });
    const animated = runInInjectionContext(injector, () => signalAnimatedNumber(source, options));
    return { animated, destroy: () => (injector as unknown as { destroy: () => void }).destroy() };
  };

  beforeEach(() => {
    frames = new Map();
    nextId = 0;
    now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.set(++nextId, cb);
      return nextId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('animates from the initial value to the target', () => {
    const onEnd = vi.fn();
    const { animated } = setup(100, { duration: 100, easing: easeLinear, onAnimationEnd: onEnd });

    animated.play();
    flushFrame(1050);
    expect(animated()).toBe(50);

    flushFrame(1100);
    expect(animated()).toBe(100);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
  });

  it('jumps straight to the target with a zero duration instead of producing NaN', () => {
    const { animated } = setup(42, { duration: 0 });

    animated.play();
    flushFrame(1000);

    expect(animated()).toBe(42);
    expect(frames.size).toBe(0);
  });

  it('never moves away from the start value when the frame timestamp precedes play()', () => {
    const { animated } = setup(100, { duration: 100, easing: easeLinear, round: (v) => v });

    animated.play();
    flushFrame(990);

    expect(animated()).toBe(0);
  });

  it('ends immediately when the target equals the current value', () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const { animated } = setup(0, { onAnimationStart: onStart, onAnimationEnd: onEnd });

    animated.play();

    expect(onStart).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
  });

  it('continues from the stopped value on the next play', () => {
    const source = signal(100);
    const { animated } = setup(source, { duration: 100, easing: easeLinear });

    animated.play();
    flushFrame(1050);
    animated.stop();
    expect(frames.size).toBe(0);

    source.set(0);
    now = 2000;
    animated.play();
    flushFrame(2050);

    expect(animated()).toBe(25);
  });

  it('reset cancels the running animation and restores the initial value', () => {
    const { animated } = setup(100, { initialValue: 10, duration: 100 });

    animated.play();
    flushFrame(1050);
    animated.reset();

    expect(animated()).toBe(10);
    expect(frames.size).toBe(0);
  });

  it('cancels the pending frame on destroy', () => {
    const { animated, destroy } = setup(100, { duration: 100 });

    animated.play();
    destroy();

    expect(frames.size).toBe(0);
  });

  it('sets the target at once when requestAnimationFrame is unavailable', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const { animated } = setup(7.6);

    animated.play();

    expect(animated()).toBe(8);
  });

  it('works when the injector is destroyed before the first play', () => {
    const { animated, destroy } = setup(100);

    destroy();
    animated.play();
    flushFrame(2000);

    expect(animated()).toBe(0);
  });
});

describe('easing functions', () => {
  it.each([
    ['easeLinear', easeLinear],
    ['easeOut', easeOut],
    ['easeInOut', easeInOut],
  ])('%s maps 0 to 0 and 1 to 1', (_, easing) => {
    expect(easing(0)).toBe(0);
    expect(easing(1)).toBe(1);
  });
});
