import { TestBed } from '@angular/core/testing';
import { injectRenderer } from '@ethlete/core';
import '../../../../../test-helpers';
import { animateNewPipInSingleMode, animateScaleFadeOut } from './pip-animation';

class ControlledAnimation {
  public onfinish: (() => void) | null = null;
  public oncancel: (() => void) | null = null;
  private settled = false;

  finish() {
    if (this.settled) return;
    this.settled = true;
    this.onfinish?.();
  }

  cancel() {
    if (this.settled) return;
    this.settled = true;
    this.oncancel?.();
  }
}

const controlAnimations = () => {
  const animations = new Map<Element, ControlledAnimation[]>();

  vi.spyOn(Element.prototype, 'animate').mockImplementation(function (this: Element) {
    const animation = new ControlledAnimation();

    animations.set(this, [...(animations.get(this) ?? []), animation]);

    return animation as unknown as Animation;
  });

  const finishAll = (el: Element) => {
    for (const animation of animations.get(el) ?? []) animation.finish();
  };

  return { animations, finishAll };
};

const rect = (width: number, height: number) => ({ left: 0, top: 0, width, height }) as DOMRect;

describe('pip animations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('settles a scale-fade-out exactly once when the animation is cancelled', () => {
    const { animations } = controlAnimations();
    const el = document.createElement('div');
    const onFinish = vi.fn();

    animateScaleFadeOut(el, { onFinish });
    const [animation] = animations.get(el) ?? [];

    animation?.cancel();

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('keeps the stage unclipped and the title bar held until the last overlapping new-pip animation ends', () => {
    vi.useFakeTimers();
    const { finishAll } = controlAnimations();
    const renderer = TestBed.runInInjectionContext(() => injectRenderer());
    const stageEl = document.createElement('div');
    const first = document.createElement('div');
    const second = document.createElement('div');
    let titleBarHolds = 0;
    const holdTitleBar = () => {
      titleBarHolds++;

      return () => void titleBarHolds--;
    };
    const start = (cell: HTMLElement) =>
      animateNewPipInSingleMode({
        cell,
        stageEl,
        stageRect: rect(320, 180),
        aspectRatio: 16 / 9,
        gridBtnEl: undefined,
        renderer,
        holdTitleBar,
      });

    start(first);
    start(second);

    finishAll(first);
    finishAll(first);
    vi.advanceTimersByTime(100);

    expect(stageEl.style.overflow).toBe('visible');
    expect(titleBarHolds).toBe(1);

    finishAll(second);
    finishAll(second);
    vi.advanceTimersByTime(100);

    expect(stageEl.style.overflow).toBe('');
    expect(titleBarHolds).toBe(0);
  });
});
