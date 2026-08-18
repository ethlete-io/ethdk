import { Component, DestroyRef, InjectionToken, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { AnimatedLifecycleDirective, AnimatedLifecycleState } from '../animations';
import { DEFAULT_OVERLAY_LAYER, OVERLAY_LAYER_ATTRIBUTE } from './overlay-layer';
import { anchoredOverlayPosition } from './overlay-position-anchored';
import { injectOverlayRuntime } from './overlay-runtime';
import { reserveOverlayViewportSpace } from './overlay-viewport-inset';

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

@Component({ template: '<button type="button">focusable content</button>' })
class FocusableOverlayComponent {}

const OVERLAY_SCOPED_TOKEN = new InjectionToken<boolean>('OVERLAY_SCOPED_TOKEN');

@Component({ template: 'overlay with a scoped provider' })
class ScopedProviderOverlayComponent {
  scoped = inject(OVERLAY_SCOPED_TOKEN);
}

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

  it('lays a centered overlay out inside the reserved viewport space', () => {
    const release = reserveOverlayViewportSpace({ bottom: 360 });
    const ref = mount({ positionStrategy: { kind: 'center' } });

    expect(ref.elements.hostElement.style.bottom).toBe('360px');

    release();

    expect(ref.elements.hostElement.style.bottom).toBe('0px');

    ref.close();
  });

  it('lets an overlay above the reserving surface use the reserved space', () => {
    const release = reserveOverlayViewportSpace({ bottom: 360, layer: DEFAULT_OVERLAY_LAYER + 1 });
    const ref = mount({ positionStrategy: { kind: 'center' }, zIndex: DEFAULT_OVERLAY_LAYER + 2 });

    expect(ref.elements.hostElement.style.bottom).toBe('0px');

    ref.close();
    release();
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
      positionStrategy: anchoredOverlayPosition({ referenceElement: virtualElement, mirrorWidth: true }),
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

  it('keeps DOM focus on the trigger across open and close with autoFocus and restoreFocus off', async () => {
    // the combobox pattern (select family): the panel opens non-modally while focus
    // stays on the trigger and options only ever receive virtual focus
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const ref = mount(
      {
        modal: false,
        hasBackdrop: false,
        autoFocus: false,
        restoreFocus: false,
        positionStrategy: anchoredOverlayPosition({ referenceElement: trigger }),
      },
      FocusableOverlayComponent,
    );

    await flushFrames();

    expect(ref.state()).toBe('mounted');
    expect(document.activeElement).toBe(trigger);

    ref.close();
    await flushFrames();

    expect(ref.state()).toBe('closed');
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });

  describe('close guards', () => {
    it('vetoes a close when a guard returns false', async () => {
      const ref = mount();
      await flushFrames();
      const guard = vi.fn(() => false);
      ref.registerCloseGuard(guard);

      ref.close('nope');

      expect(guard).toHaveBeenCalledWith({ result: 'nope', source: 'api' });
      expect(ref.state()).toBe('mounted');

      ref.forceClose();
    });

    it('proceeds when every guard returns true', () => {
      const ref = mount();
      ref.registerCloseGuard(() => true);

      ref.close();

      expect(ref.state()).toBe('closed');
    });

    it('vetoes if any one of several guards returns false', async () => {
      const ref = mount();
      await flushFrames();
      ref.registerCloseGuard(() => true);
      ref.registerCloseGuard(() => false);

      ref.close();

      expect(ref.state()).toBe('mounted');
      ref.forceClose();
    });

    it('forceClose bypasses guards', () => {
      const ref = mount();
      ref.registerCloseGuard(() => false);

      ref.forceClose('forced', 'escape');

      expect(ref.state()).toBe('closed');
    });

    it('reference-detached closes bypass guards', () => {
      const ref = mount();
      ref.registerCloseGuard(() => false);

      ref.close(undefined, 'reference-detached');

      expect(ref.state()).toBe('closed');
    });

    it('stops consulting a guard once it is unregistered', async () => {
      const ref = mount();
      await flushFrames();
      const unregister = ref.registerCloseGuard(() => false);

      ref.close();
      expect(ref.state()).toBe('mounted');

      unregister();
      ref.close();
      expect(ref.state()).toBe('closed');
    });
  });

  describe('stacking levels', () => {
    it('mounts into a root at the default level', () => {
      const ref = mount();

      expect(ref.elements.rootElement.style.zIndex).toBe(`${DEFAULT_OVERLAY_LAYER}`);
      expect(ref.elements.rootElement.getAttribute(OVERLAY_LAYER_ATTRIBUTE)).toBe(`${DEFAULT_OVERLAY_LAYER}`);

      ref.close();
    });

    it('gives each level its own root and keeps a lower one mounted', () => {
      const base = mount();
      const raised = mount({ zIndex: DEFAULT_OVERLAY_LAYER + 10 });

      expect(raised.elements.rootElement).not.toBe(base.elements.rootElement);
      expect(raised.elements.rootElement.style.zIndex).toBe(`${DEFAULT_OVERLAY_LAYER + 10}`);
      expect(document.querySelectorAll('.et-overlay-runtime-root')).toHaveLength(2);

      raised.close();

      expect(base.elements.rootElement.isConnected).toBe(true);
      expect(raised.elements.rootElement.isConnected).toBe(false);

      base.close();

      expect(base.elements.rootElement.isConnected).toBe(false);
    });

    it('shares one root between overlays on the same level', () => {
      const first = mount({ zIndex: DEFAULT_OVERLAY_LAYER + 10 });
      const second = mount({ zIndex: DEFAULT_OVERLAY_LAYER + 10 });

      expect(second.elements.rootElement).toBe(first.elements.rootElement);

      first.close();
      second.close();
    });

    it('keeps a non-modal overlay open on a press landing on a level above it', async () => {
      const raisedSurface = document.createElement('div');
      raisedSurface.setAttribute(OVERLAY_LAYER_ATTRIBUTE, `${DEFAULT_OVERLAY_LAYER + 10}`);

      const raisedTarget = document.createElement('button');
      const plainTarget = document.createElement('button');

      raisedSurface.append(raisedTarget);
      document.body.append(raisedSurface, plainTarget);

      const ref = mount({ modal: false });

      await flushFrames();

      raisedTarget.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

      expect(ref.state()).toBe('mounted');

      plainTarget.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

      expect(ref.state()).toBe('closed');

      raisedSurface.remove();
      plainTarget.remove();
    });
  });

  it('destroys the injector holding the overlay providers on close', () => {
    const onProviderDestroy = vi.fn();
    const ref = mount(
      {
        providers: [
          {
            provide: OVERLAY_SCOPED_TOKEN,
            useFactory: () => {
              inject(DestroyRef).onDestroy(onProviderDestroy);

              return true;
            },
          },
        ],
      },
      ScopedProviderOverlayComponent,
    );

    expect(onProviderDestroy).not.toHaveBeenCalled();

    ref.close();

    expect(onProviderDestroy).toHaveBeenCalledTimes(1);
  });

  it('tears down synchronously without a leave animation when the reference detaches', async () => {
    const ref = mount({}, AnimatedOverlayComponent);

    await flushFrames();

    expect(ref.state()).toBe('mounted');

    ref.close(undefined, 'reference-detached');

    // no leave transition to animate away from a stale position - destroy immediately
    expect(fakeLifecycle.leave).not.toHaveBeenCalled();
    expect(ref.state()).toBe('closed');
  });
});
