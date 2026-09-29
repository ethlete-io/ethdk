import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnimatedIfDirective } from './animated-if.directive';
import { AnimatedLifecycleDirective } from './animated-lifecycle.directive';

@Component({
  selector: 'et-animated-lifecycle-host',
  template: `<div #target etAnimatedLifecycle></div>`,
  imports: [AnimatedLifecycleDirective],
})
class AnimatedLifecycleHostComponent {
  public target = viewChild.required<ElementRef<HTMLElement>>('target');
  public lifecycle = viewChild.required(AnimatedLifecycleDirective);
}

@Component({
  selector: 'et-animated-if-host',
  template: `<div etAnimatedLifecycle><p *etAnimatedIf="show()"></p></div>`,
  imports: [AnimatedLifecycleDirective, AnimatedIfDirective],
})
class AnimatedIfHostComponent {
  public show = signal(false);
  public lifecycle = viewChild.required(AnimatedLifecycleDirective);
}

/** A stand-in for a running CSS transition. jsdom implements neither `getAnimations` nor transitions. */
const fakeAnimation = () => {
  let settle!: () => void;
  const finished = new Promise<void>((resolve) => (settle = resolve));

  return {
    animation: {
      playState: 'running',
      effect: { pseudoElement: null, getComputedTiming: () => ({ iterations: 1 }) },
      finished,
    },
    settle,
  };
};

const nextFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('AnimatedLifecycleDirective', () => {
  let element: HTMLElement;
  let lifecycle: AnimatedLifecycleDirective;

  const setRunningAnimations = (animations: unknown[]) => {
    (element as unknown as { getAnimations: () => unknown[] }).getAnimations = () => animations;
  };

  beforeEach(async () => {
    const fixture = TestBed.createComponent(AnimatedLifecycleHostComponent);
    fixture.detectChanges();

    element = fixture.componentInstance.target().nativeElement;
    lifecycle = fixture.componentInstance.lifecycle();

    setRunningAnimations([]);
    lifecycle.enter();
    await nextFrames();
    await nextFrames();
  });

  it('waits for the running animation to finish before leaving', async () => {
    const { animation, settle } = fakeAnimation();
    setRunningAnimations([animation]);

    lifecycle.leave();
    await nextFrames();
    await nextFrames();

    expect(lifecycle.state$.value).toBe('leaving');

    setRunningAnimations([]);
    settle();
    await nextFrames();

    expect(lifecycle.state$.value).toBe('left');
  });

  it('leaves without waiting when the class change starts no animation', async () => {
    setRunningAnimations([]);

    lifecycle.leave();
    await nextFrames();
    await nextFrames();

    expect(lifecycle.state$.value).toBe('left');
  });

  it('does not settle synchronously while leave() is still on the stack', () => {
    setRunningAnimations([]);

    lifecycle.leave();

    expect(lifecycle.state$.value).toBe('leaving');
  });

  it('waits for the replacement when an animation is retargeted instead of finished', async () => {
    const first = fakeAnimation();
    setRunningAnimations([first.animation]);

    lifecycle.leave();
    await nextFrames();
    await nextFrames();

    const second = fakeAnimation();
    setRunningAnimations([second.animation]);
    first.settle();
    await nextFrames();

    expect(lifecycle.state$.value).toBe('leaving');

    setRunningAnimations([]);
    second.settle();
    await nextFrames();

    expect(lifecycle.state$.value).toBe('left');
  });
});

describe('AnimatedLifecycleDirective transitions', () => {
  let element: HTMLElement;
  let lifecycle: AnimatedLifecycleDirective;

  const frames = (count = 1) => vi.advanceTimersByTime(40 * count);
  const hasClass = (name: string) => element.classList.contains(`et-animation-${name}`);

  beforeEach(() => {
    vi.useFakeTimers();

    const fixture = TestBed.createComponent(AnimatedLifecycleHostComponent);
    fixture.detectChanges();

    element = fixture.componentInstance.target().nativeElement;
    lifecycle = fixture.componentInstance.lifecycle();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('enter', () => {
    it('starts invisible in the init state', () => {
      expect(lifecycle.state$.value).toBe('init');
      expect(element.classList.contains('et-force-invisible')).toBe(true);
    });

    it('runs from, active and to classes and ends in the entered state', () => {
      lifecycle.enter();

      expect(lifecycle.state$.value).toBe('entering');
      expect(element.classList.contains('et-force-invisible')).toBe(false);
      expect(hasClass('enter-from')).toBe(true);
      expect(hasClass('enter-active')).toBe(true);
      expect(hasClass('enter-to')).toBe(false);

      frames();

      expect(hasClass('enter-from')).toBe(false);
      expect(hasClass('enter-to')).toBe(true);
      expect(lifecycle.state$.value).toBe('entering');

      frames();

      expect(lifecycle.state$.value).toBe('entered');
      expect(hasClass('enter-active')).toBe(false);
      expect(hasClass('enter-to')).toBe(false);
      expect(hasClass('enter-done')).toBe(true);
    });

    it('emits every state change on state$ in order', () => {
      const states: string[] = [];
      lifecycle.state$.subscribe((state) => states.push(state));

      lifecycle.enter();
      frames(2);

      expect(states).toEqual(['init', 'entering', 'entered']);
    });

    it('does nothing when called while already entering', () => {
      lifecycle.enter();
      lifecycle.enter();
      frames(2);

      expect(lifecycle.state$.value).toBe('entered');
    });

    it('leaves instantly from init because no enter ever ran', () => {
      lifecycle.leave();

      expect(lifecycle.state$.value).toBe('left');
      expect(hasClass('leave-done')).toBe(true);
    });

    it('removes the leave-done class when entering again', () => {
      lifecycle.leave();
      lifecycle.enter();

      expect(hasClass('leave-done')).toBe(false);
    });
  });

  describe('leave', () => {
    beforeEach(() => {
      lifecycle.enter();
      frames(2);
    });

    it('runs from, active and to classes and ends in the left state', () => {
      lifecycle.leave();

      expect(lifecycle.state$.value).toBe('leaving');
      expect(hasClass('enter-done')).toBe(false);
      expect(hasClass('leave-from')).toBe(true);
      expect(hasClass('leave-active')).toBe(true);

      frames(2);

      expect(lifecycle.state$.value).toBe('left');
      expect(hasClass('leave-active')).toBe(false);
      expect(hasClass('leave-to')).toBe(false);
      expect(hasClass('leave-done')).toBe(true);
    });
  });

  describe('interrupts', () => {
    it('turns a leave during enter around into a leave with the interrupt class', () => {
      lifecycle.enter();
      frames();
      lifecycle.leave();

      expect(lifecycle.state$.value).toBe('leaving');
      expect(hasClass('enter-active')).toBe(false);
      expect(hasClass('enter-to')).toBe(false);
      expect(hasClass('leave-active')).toBe(true);
      expect(hasClass('leave-to')).toBe(true);
      expect(hasClass('leave-interrupt')).toBe(true);

      frames(2);

      expect(lifecycle.state$.value).toBe('left');
      expect(hasClass('leave-done')).toBe(true);
      expect(hasClass('enter-done')).toBe(false);
    });

    it('never completes the interrupted enter after a leave took over', () => {
      const states: string[] = [];
      lifecycle.enter();
      lifecycle.leave();
      lifecycle.state$.subscribe((state) => states.push(state));
      frames(4);

      expect(states).toEqual(['leaving', 'left']);
    });

    it('turns an enter during leave around into an enter with the interrupt class', () => {
      lifecycle.enter();
      frames(2);
      lifecycle.leave();
      frames();
      lifecycle.enter();

      expect(lifecycle.state$.value).toBe('entering');
      expect(hasClass('leave-active')).toBe(false);
      expect(hasClass('leave-to')).toBe(false);
      expect(hasClass('enter-active')).toBe(true);
      expect(hasClass('enter-to')).toBe(true);
      expect(hasClass('enter-interrupt')).toBe(true);

      frames(2);

      expect(lifecycle.state$.value).toBe('entered');
      expect(hasClass('enter-done')).toBe(true);
      expect(hasClass('leave-done')).toBe(false);
    });

    it('never completes the interrupted leave after an enter took over', () => {
      const states: string[] = [];
      lifecycle.enter();
      frames(2);
      lifecycle.leave();
      lifecycle.enter();
      lifecycle.state$.subscribe((state) => states.push(state));
      frames(4);

      expect(states).toEqual(['entering', 'entered']);
    });

    it('drops the interrupt class when the next transition is not an interrupt', () => {
      lifecycle.enter();
      lifecycle.leave();
      frames(2);
      lifecycle.enter();
      frames(2);
      lifecycle.leave();

      expect(hasClass('leave-interrupt')).toBe(false);
      expect(hasClass('enter-interrupt')).toBe(false);
    });
  });

  describe('skipNextEnter', () => {
    it('enters instantly and resets itself', () => {
      lifecycle.skipNextEnter.set(true);
      lifecycle.enter();

      expect(lifecycle.state$.value).toBe('entered');
      expect(hasClass('enter-done')).toBe(true);
      expect(hasClass('enter-from')).toBe(false);
      expect(lifecycle.skipNextEnter()).toBe(false);
    });

    it('animates the enter after the skipped one', () => {
      lifecycle.skipNextEnter.set(true);
      lifecycle.enter();
      lifecycle.leave();
      frames(2);
      lifecycle.enter();

      expect(lifecycle.state$.value).toBe('entering');
      expect(hasClass('enter-from')).toBe(true);
    });
  });

  describe('forced states', () => {
    it('forceEnteredState jumps to entered without a transition', () => {
      lifecycle.forceEnteredState();

      expect(lifecycle.state$.value).toBe('entered');
      expect(hasClass('enter-done')).toBe(true);
      expect(element.classList.contains('et-force-invisible')).toBe(false);
    });

    it('forceLeftState jumps to left without a transition', () => {
      lifecycle.forceLeftState();

      expect(lifecycle.state$.value).toBe('left');
      expect(hasClass('leave-done')).toBe(true);
    });

    it('forceLeftState cancels a running enter transition and clears its classes', () => {
      lifecycle.enter();
      lifecycle.forceLeftState();
      frames(4);

      expect(lifecycle.state$.value).toBe('left');
      expect(hasClass('enter-from')).toBe(false);
      expect(hasClass('enter-active')).toBe(false);
      expect(hasClass('enter-to')).toBe(false);
    });

    it('forceEnteredState cancels a running leave transition and clears its classes', () => {
      lifecycle.enter();
      frames(2);
      lifecycle.leave();
      lifecycle.forceEnteredState();
      frames(4);

      expect(lifecycle.state$.value).toBe('entered');
      expect(hasClass('leave-from')).toBe(false);
      expect(hasClass('leave-active')).toBe(false);
      expect(hasClass('enter-done')).toBe(true);
    });

    it('skips the animation of a transition started in the same frame as a force', () => {
      lifecycle.forceEnteredState();
      lifecycle.leave();

      expect(lifecycle.state$.value).toBe('left');
      expect(hasClass('leave-done')).toBe(true);

      lifecycle.forceLeftState();
      lifecycle.enter();

      expect(lifecycle.state$.value).toBe('entered');
      expect(hasClass('enter-done')).toBe(true);
    });

    it('animates a transition started a frame after a force', () => {
      lifecycle.forceEnteredState();
      vi.advanceTimersByTime(20);
      lifecycle.leave();

      expect(lifecycle.state$.value).toBe('leaving');
    });
  });
});

describe('AnimatedIfDirective', () => {
  let fixture: ComponentFixture<AnimatedIfHostComponent>;

  const frames = (count = 1) => vi.advanceTimersByTime(40 * count);
  const paragraph = () => fixture.nativeElement.querySelector('p');
  const setShow = (value: boolean) => {
    fixture.componentInstance.show.set(value);
    fixture.detectChanges();
  };

  const create = (initial: boolean) => {
    fixture = TestBed.createComponent(AnimatedIfHostComponent);
    fixture.componentInstance.show.set(initial);
    fixture.detectChanges();
  };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders nothing while the value is falsy', () => {
    create(false);

    expect(paragraph()).toBeNull();
    expect(fixture.componentInstance.lifecycle().state$.value).toBe('init');
  });

  it('renders the view and enters when the value turns truthy', () => {
    create(false);
    setShow(true);

    expect(paragraph()).not.toBeNull();
    expect(fixture.componentInstance.lifecycle().state$.value).toBe('entering');

    frames(2);

    expect(fixture.componentInstance.lifecycle().state$.value).toBe('entered');
  });

  it('enters instantly when truthy from the first render', () => {
    create(true);

    expect(paragraph()).not.toBeNull();
    expect(fixture.componentInstance.lifecycle().state$.value).toBe('entered');
  });

  it('keeps the view until the leave finished, then removes it', () => {
    create(true);
    setShow(false);

    expect(fixture.componentInstance.lifecycle().state$.value).toBe('leaving');
    expect(paragraph()).not.toBeNull();

    frames(2);

    expect(fixture.componentInstance.lifecycle().state$.value).toBe('left');
    expect(paragraph()).toBeNull();
  });

  it('keeps the same view when the value turns truthy again during the leave', () => {
    create(true);
    const view = paragraph();
    setShow(false);
    frames();
    setShow(true);
    frames(4);

    expect(paragraph()).toBe(view);
    expect(fixture.componentInstance.lifecycle().state$.value).toBe('entered');
  });

  it('creates a new view when entering again after the view was removed', () => {
    create(true);
    const view = paragraph();
    setShow(false);
    frames(2);
    setShow(true);

    expect(paragraph()).not.toBeNull();
    expect(paragraph()).not.toBe(view);
  });

  it('does nothing for a falsy value that stays falsy', () => {
    create(false);
    setShow(false);

    expect(fixture.componentInstance.lifecycle().state$.value).toBe('init');
  });
});
