import { Component, ElementRef, WritableSignal, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnimatedSizeAxis, injectAnimatedBlockSize } from './animated-block-size';

type FakeAnimation = {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  playState: string;
  cancel: () => void;
  finished: { then: (onFulfilled: () => void) => { catch: (onRejected: () => void) => void } };
  finish: () => void;
};

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];

  observed = new Set<Element>();
  disconnected = false;

  constructor(private callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }

  observe = (element: Element) => this.observed.add(element);
  disconnect = () => {
    this.observed.clear();
    this.disconnected = true;
  };
  unobserve = () => undefined;
  trigger = () => this.callback();
}

const config: { axes: AnimatedSizeAxis[] | WritableSignal<AnimatedSizeAxis[]> | undefined; resizingClass?: string } = {
  axes: undefined,
};

@Component({
  selector: 'et-animated-block-size-host',
  template: `<div #content></div>`,
})
class AnimatedBlockSizeHostComponent {
  content = viewChild.required<ElementRef<HTMLElement>>('content');

  constructor() {
    injectAnimatedBlockSize({
      observe: this.content,
      axes: config.axes,
      duration: 200,
      easing: 'linear',
      resizingClass: config.resizingClass,
    });
  }
}

describe('injectAnimatedBlockSize', () => {
  let fixture: ComponentFixture<AnimatedBlockSizeHostComponent>;
  let host: HTMLElement;
  let animations: FakeAnimation[];
  let natural: { height: number; width: number };
  let animated: { height: number; width: number };

  const running = () => animations.find((animation) => animation.playState === 'running');

  const setup = (options?: { reducedMotion?: boolean; axes?: typeof config.axes; resizingClass?: string }) => {
    config.axes = options?.axes;
    config.resizingClass = options?.resizingClass;

    if (options?.reducedMotion) {
      window.matchMedia = (() => ({
        matches: true,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      })) as unknown as typeof window.matchMedia;
    }

    fixture = TestBed.createComponent(AnimatedBlockSizeHostComponent);
    host = fixture.nativeElement;

    host.getBoundingClientRect = () => {
      const size = running() ? animated : natural;
      return { height: size.height, width: size.width } as DOMRect;
    };
    host.animate = ((keyframes: Keyframe[], animationOptions: KeyframeAnimationOptions) => {
      let onFulfilled: () => void = () => undefined;
      let onRejected: () => void = () => undefined;

      const animation: FakeAnimation = {
        keyframes,
        options: animationOptions,
        playState: 'running',
        finished: {
          then: (callback) => {
            onFulfilled = callback;
            return { catch: (rejected) => (onRejected = rejected) };
          },
        },
        finish: () => {
          animation.playState = 'finished';
          onFulfilled();
        },
        cancel: () => {
          if (animation.playState === 'idle') return;
          animation.playState = 'idle';
          onRejected();
        },
      };

      animations.push(animation);
      return animation as unknown as Animation;
    }) as typeof host.animate;

    fixture.detectChanges();
    fixture.detectChanges();
  };

  const resizeTo = (height: number, width = natural.width) => {
    natural = { height, width };
    FakeResizeObserver.instances.at(-1)?.trigger();
  };

  beforeEach(() => {
    FakeResizeObserver.instances = [];
    animations = [];
    natural = { height: 100, width: 200 };
    animated = { height: 130, width: 200 };
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('observes the content element and not the animated host', () => {
    setup();

    const observer = FakeResizeObserver.instances[0];

    expect(observer?.observed.has(fixture.componentInstance.content().nativeElement)).toBe(true);
    expect(observer?.observed.has(host)).toBe(false);
  });

  it('does not animate when the size did not change since the first render', () => {
    setup();

    resizeTo(100);

    expect(animations).toHaveLength(0);
  });

  it('animates the block size from the previous to the new size with the configured timing', () => {
    setup();

    resizeTo(160);

    expect(animations).toHaveLength(1);
    expect(animations[0]?.keyframes).toEqual([{ blockSize: '100px' }, { blockSize: '160px' }]);
    expect(animations[0]?.options).toEqual({ duration: 200, easing: 'linear' });
  });

  it('animates from the last size on consecutive changes', () => {
    setup();

    resizeTo(160);
    animations[0]?.finish();
    resizeTo(120);

    expect(animations[1]?.keyframes).toEqual([{ blockSize: '160px' }, { blockSize: '120px' }]);
  });

  it('ignores a change smaller than one pixel', () => {
    setup();

    resizeTo(100.5);

    expect(animations).toHaveLength(0);
  });

  it('does not animate the inline axis by default', () => {
    setup();

    resizeTo(160, 300);

    expect(animations[0]?.keyframes).toEqual([{ blockSize: '100px' }, { blockSize: '160px' }]);
  });

  it('animates both axes when both are configured', () => {
    setup({ axes: ['block', 'inline'] });

    resizeTo(160, 300);

    expect(animations[0]?.keyframes).toEqual([
      { blockSize: '100px', inlineSize: '200px' },
      { blockSize: '160px', inlineSize: '300px' },
    ]);
  });

  it('animates only the inline axis when block is not configured', () => {
    setup({ axes: ['inline'] });

    resizeTo(160, 300);

    expect(animations[0]?.keyframes).toEqual([{ inlineSize: '200px' }, { inlineSize: '300px' }]);
  });

  it('reads the axes signal on every change', () => {
    const axes = signal<AnimatedSizeAxis[]>(['block', 'inline']);
    setup({ axes });

    resizeTo(160, 300);
    animations[0]?.finish();
    axes.set(['block']);
    resizeTo(200, 400);

    expect(animations[1]?.keyframes).toEqual([{ blockSize: '160px' }, { blockSize: '200px' }]);
  });

  it('ignores a zero measurement and keeps the last real size as the baseline', () => {
    setup();

    resizeTo(0);

    expect(animations).toHaveLength(0);

    resizeTo(160);

    expect(animations[0]?.keyframes).toEqual([{ blockSize: '100px' }, { blockSize: '160px' }]);
  });

  it('continues from the current animated size when a change interrupts a running animation', () => {
    setup();

    resizeTo(160);
    resizeTo(90);

    expect(animations[0]?.playState).toBe('idle');
    expect(animations[1]?.keyframes).toEqual([{ blockSize: '130px' }, { blockSize: '90px' }]);
  });

  it('keeps the resizing class on the host from start until the animation finishes', () => {
    setup({ resizingClass: 'is-resizing' });

    resizeTo(160);

    expect(host.classList.contains('is-resizing')).toBe(true);

    animations[0]?.finish();

    expect(host.classList.contains('is-resizing')).toBe(false);
  });

  it('keeps the resizing class while an interrupting animation is still running', () => {
    setup({ resizingClass: 'is-resizing' });

    resizeTo(160);
    resizeTo(90);

    expect(host.classList.contains('is-resizing')).toBe(true);

    animations[1]?.finish();

    expect(host.classList.contains('is-resizing')).toBe(false);
  });

  it('does not animate under prefers-reduced-motion', () => {
    setup({ reducedMotion: true, resizingClass: 'is-resizing' });

    resizeTo(160);

    expect(animations).toHaveLength(0);
    expect(host.classList.contains('is-resizing')).toBe(false);
  });

  it('cancels the running animation and disconnects the observer on destroy', () => {
    setup();

    resizeTo(160);
    fixture.destroy();

    expect(animations[0]?.playState).toBe('idle');
    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
  });
});
