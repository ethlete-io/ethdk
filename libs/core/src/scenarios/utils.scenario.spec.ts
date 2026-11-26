import { provideLocationMocks } from '@angular/common/testing';
import { Component, inject, InjectionToken } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { canUseSessionMemory, clamp, createComponentId, createLogger } from '../index';
import { useScenario } from './harness';

@Component({ selector: 'et-scenario-lottie', template: '<div [id]="instanceId"></div>' })
class LottieComponent {
  instanceId = createComponentId('scenario-lottie');
}

const loadWide = () => canUseSessionMemory() && sessionStorage.getItem('scenario-list-wide') === '1';

describe('util scenarios', () => {
  const scenario = useScenario({
    providers: [provideRouter([{ path: '', children: [] }]), provideLocationMocks()],
  });

  it('gives every component instance and provider token its own id', () => {
    const s = scenario();
    const first = TestBed.createComponent(LottieComponent);
    const second = TestBed.createComponent(LottieComponent);

    s.tick();

    const [a, b] = [first, second].map((fixture) => (fixture.nativeElement as HTMLElement).querySelector('div')?.id);

    expect(a).toMatch(/^scenario-lottie-\d+$/);
    expect(b).toMatch(/^scenario-lottie-\d+$/);
    expect(a).not.toBe(b);

    const token = new InjectionToken<string>(createComponentId('scenario-provider'));
    expect(token.toString()).toMatch(/scenario-provider-\d+/);

    first.destroy();
    second.destroy();
  });

  it('clamps a progress value and an active page into range', () => {
    scenario();

    expect([clamp(-5), clamp(50), clamp(150)]).toEqual([0, 50, 100]);
    expect(clamp(12, 1, 8)).toBe(8);
    expect(clamp(0, 1, 8)).toBe(1);
  });

  it('reads a stored list preference only where session storage exists', () => {
    scenario();
    sessionStorage.setItem('scenario-list-wide', '1');

    try {
      expect(canUseSessionMemory()).toBe(true);
      expect(loadWide()).toBe(true);

      const storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        get: () => {
          throw new DOMException('denied', 'SecurityError');
        },
      });

      try {
        expect(canUseSessionMemory()).toBe(false);
        expect(loadWide()).toBe(false);
      } finally {
        if (storage) Object.defineProperty(globalThis, 'sessionStorage', storage);
      }
    } finally {
      sessionStorage.removeItem('scenario-list-wide');
    }
  });

  it('logs with a scoped prefix until the quiet query param is set', async () => {
    const s = scenario();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const logger = s.run(() => createLogger({ scope: 'USER NOTIFICATIONS', feature: 'Provider' }));
      await s.run(() => inject(Router)).navigateByUrl('/');
      await s.settle();

      logger.log('loaded', 3);
      logger.warn('slow');

      expect(log).toHaveBeenCalledWith(expect.stringContaining('[USER NOTIFICATIONS Provider]'), 'loaded', 3);
      s.expectWarning('[USER NOTIFICATIONS Provider]');

      await s.run(() => inject(Router)).navigateByUrl('/?et-logger-quiet=true');
      await s.settle();
      log.mockClear();

      logger.log('hidden');
      logger.error('hidden');

      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
