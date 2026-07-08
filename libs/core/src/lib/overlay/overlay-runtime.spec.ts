import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { AnimatedLifecycleDirective, AnimatedLifecycleState } from '../animations';
import { injectOverlayRuntime } from './overlay-runtime';

const createFakeLifecycle = () => {
  const state$ = new BehaviorSubject<AnimatedLifecycleState>('init');

  return {
    state$,
    enter: vi.fn(() => state$.next('entered')),
    leave: vi.fn(() => state$.next('left')),
  } as unknown as AnimatedLifecycleDirective & { enter: ReturnType<typeof vi.fn>; leave: ReturnType<typeof vi.fn> };
};

let fakeLifecycle = createFakeLifecycle();

@Component({ template: 'plain overlay' })
class PlainOverlayComponent {}

@Component({ template: 'animated overlay' })
class AnimatedOverlayComponent {
  animatedLifecycle = signal(fakeLifecycle);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('overlay runtime', () => {
  beforeEach(() => {
    fakeLifecycle = createFakeLifecycle();
  });

  const mount = (
    config: Record<string, unknown> = {},
    component: typeof PlainOverlayComponent = PlainOverlayComponent,
  ) =>
    TestBed.runInInjectionContext(() =>
      injectOverlayRuntime().mount({
        id: 'test-overlay',
        component,
        ...config,
      }),
    );

  it('applies global positioning styles', () => {
    const ref = mount({ positionStrategy: { kind: 'global', vertical: 'end' } });

    expect(ref.elements.hostElement.style.display).toBe('grid');
    expect(ref.elements.hostElement.style.padding).toBe('0px');
    expect(ref.elements.paneElement.style.position).toBe('relative');

    ref.close();
  });

  it('re-positions in place via updatePositionStrategy', () => {
    const ref = mount({ positionStrategy: { kind: 'global' } });

    ref.updatePositionStrategy({ kind: 'center' });

    // the center strategy is recognizable by its built-in host padding + overflow
    expect(ref.elements.hostElement.style.padding).toBe('16px');
    expect(ref.elements.hostElement.style.overflow).toBe('auto');

    ref.updatePositionStrategy({ kind: 'global' });

    expect(ref.elements.hostElement.style.padding).toBe('0px');
    expect(ref.elements.hostElement.style.overflow).toBe('');

    ref.close();
  });

  it('anchors to a virtual element without mirroring its width', () => {
    const virtualElement = {
      getBoundingClientRect: () => new DOMRect(120, 80, 0, 0),
    };

    const ref = mount({
      positionStrategy: { kind: 'anchored', referenceElement: virtualElement, mirrorWidth: true },
    });

    expect(ref.elements.paneElement.style.position).toBe('absolute');
    // mirrorWidth requires a measurable HTMLElement; virtual references fall back to max-content
    expect(ref.elements.paneElement.style.width).toBe('max-content');

    ref.close();
  });

  it('uses the animation delegate instead of the default enter/leave', async () => {
    const enter = vi.fn();
    const leave = vi.fn();
    const ref = mount({ animationDelegate: { enter, leave } }, AnimatedOverlayComponent);

    await flushFrames();

    expect(enter).toHaveBeenCalledOnce();
    expect(fakeLifecycle.enter).not.toHaveBeenCalled();

    // delegate is responsible for finishing the enter transition
    fakeLifecycle.state$.next('entered');
    expect(ref.state()).toBe('mounted');

    ref.close('result');

    expect(leave).toHaveBeenCalledOnce();
    expect(leave.mock.calls[0]?.[0]?.closeEvent).toEqual({ result: 'result', source: 'api' });
    expect(fakeLifecycle.leave).not.toHaveBeenCalled();

    fakeLifecycle.state$.next('left');
    expect(ref.state()).toBe('closed');
  });

  it('keeps the default lifecycle handling without a delegate', async () => {
    const ref = mount({}, AnimatedOverlayComponent);

    await flushFrames();

    expect(fakeLifecycle.enter).toHaveBeenCalledOnce();
    expect(ref.state()).toBe('mounted');

    ref.close();

    expect(fakeLifecycle.leave).toHaveBeenCalledOnce();
    expect(ref.state()).toBe('closed');
  });
});
