import { Component, ElementRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
