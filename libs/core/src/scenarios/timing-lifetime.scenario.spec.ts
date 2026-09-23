import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import {
  controlValueSignal,
  injectAngularRootElement,
  KeyPressManager,
  ScrollObserverDirective,
  ScrollObserverEndDirective,
  ScrollObserverStartDirective,
  signalAnimatedNumber,
  signalCountdown,
  writeScrollbarSizeToCssVariables,
  writeViewportSizeToCssVariables,
} from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-root',
  template: '',
})
class ScenarioRootComponent {}

@Component({
  selector: 'et-scenario-scroll-observer',
  imports: [ScrollObserverDirective, ScrollObserverStartDirective, ScrollObserverEndDirective],
  template: `
    <div #observer="etScrollObserver" etScrollObserver>
      @if (showStart()) {
        <div class="start" etScrollObserverStart></div>
      }
      <div class="end" etScrollObserverEnd></div>
    </div>
  `,
})
class ScenarioScrollObserverComponent {
  showStart = signal(true);
}

const CSS_VARS = ['--et-vw', '--et-vh', '--et-sw', '--et-sh'] as const;

const readCssVars = () =>
  CSS_VARS.filter((property) => document.documentElement.style.getPropertyValue(property) !== '');

const clearCssVars = () => CSS_VARS.forEach((property) => document.documentElement.style.removeProperty(property));

const backspace = () => new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8 });

describe('timing and lifetime scenarios', () => {
  const scenario = useScenario();

  describe('signalAnimatedNumber', () => {
    it('animates to the target on the frame clock and reports the end once', () => {
      const s = scenario();
      const c = s.consumer();
      const ends: number[] = [];
      const target = signal(100);
      const value = c.run(() =>
        signalAnimatedNumber(target, { duration: 1000, onAnimationEnd: () => ends.push(value()) }),
      );

      value.play();
      s.frame();
      s.tick(500);
      s.frame();

      expect(value()).toBe(75);
      expect(ends).toEqual([]);

      s.flush();

      expect(value()).toBe(100);
      expect(ends).toEqual([100]);
    });

    it('stops its frame loop when its owner is destroyed mid-animation', () => {
      const s = scenario();
      const c = s.consumer();
      const ends: number[] = [];
      const value = c.run(() => signalAnimatedNumber(100, { duration: 1000, onAnimationEnd: () => ends.push(1) }));

      value.play();
      s.frame();
      s.tick(250);
      s.frame();

      const midway = value();

      expect(midway).toBeGreaterThan(0);
      expect(midway).toBeLessThan(100);

      c.destroy();

      expect(s.pendingFrames()).toBe(0);

      s.tick(1000);
      s.frame();

      expect(value()).toBe(midway);
      expect(ends).toEqual([]);
    });
  });

  describe('signalCountdown', () => {
    it('counts down on the whole second and stops its timer once the deadline passes', () => {
      const s = scenario();
      const deadline = signal(Date.now() + 61_500);
      const countdown = s.consumer().run(() => signalCountdown(deadline));

      s.tick(0);
      expect(countdown()).toMatchObject({ minutes: 1, seconds: 2, hasPassed: false });

      s.tick(500);
      expect(countdown()).toMatchObject({ minutes: 1, seconds: 1 });

      s.tick(61_000);
      expect(countdown()).toMatchObject({ totalSeconds: 0, hasPassed: true });
      expect(vi.getTimerCount()).toBe(0);
    });

    it('stops ticking when its owner is destroyed mid-countdown', () => {
      const s = scenario();
      const c = s.consumer();
      const countdown = c.run(() => signalCountdown(() => Date.now() + 3_600_000));

      s.tick(1000);
      expect(countdown()?.totalSeconds).toBe(3599);

      c.destroy();

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('injectAngularRootElement', () => {
    it('resolves the root element once a root component bootstraps', async () => {
      const s = scenario();
      const app = await s.app();
      const host = document.createElement('et-scenario-root');
      document.body.appendChild(host);
      onTestFinished(() => host.remove());

      const rootElement = app.run(() => injectAngularRootElement());

      s.tick(100);
      expect(rootElement()).toBeNull();

      app.appRef.bootstrap(ScenarioRootComponent, host);
      s.tick(25);

      expect(rootElement()).toBe(host);
      expect(vi.getTimerCount()).toBe(0);

      app.destroy();
    });

    it('stops polling when the app is destroyed before a root component mounts', async () => {
      const s = scenario();
      const app = await s.app();
      const rootElement = app.run(() => injectAngularRootElement());

      s.tick(200);
      expect(rootElement()).toBeNull();

      app.destroy();

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('scroll observer sentinels', () => {
    it('forgets a start sentinel that leaves the view', () => {
      const s = scenario();
      const fixture = TestBed.createComponent(ScenarioScrollObserverComponent);

      s.flush();

      const root = fixture.nativeElement as HTMLElement;
      const start = root.querySelector('.start') as HTMLElement;
      const end = root.querySelector('.end') as HTMLElement;
      const observer = fixture.debugElement.children[0]?.injector.get(ScrollObserverDirective);

      expect(s.observedElements()).toEqual(expect.arrayContaining([start, end]));

      s.intersect(start, true);
      s.intersect(end, true);

      expect(observer?.isAtStart()).toBe(true);
      expect(observer?.isAtEnd()).toBe(true);

      fixture.componentInstance.showStart.set(false);
      s.flush();

      expect(s.observedElements()).not.toContain(start);
      expect(observer?.isAtStart()).toBe(false);
      expect(observer?.isAtEnd()).toBe(true);

      fixture.destroy();
    });
  });

  describe('css-vars writers', () => {
    afterEach(clearCssVars);

    it('writes the variables again for an app that starts after another one was torn down', async () => {
      const s = scenario();
      const first = await s.app();

      first.run(() => {
        writeViewportSizeToCssVariables();
        writeScrollbarSizeToCssVariables();
      });
      s.flush();

      expect(readCssVars()).toEqual(CSS_VARS);

      first.destroy();
      clearCssVars();

      const second = await s.app();

      second.run(() => {
        writeViewportSizeToCssVariables();
        writeScrollbarSizeToCssVariables();
      });
      s.flush();

      expect(readCssVars()).toEqual(CSS_VARS);

      second.destroy();
    });
  });

  describe('KeyPressManager', () => {
    it('reports a repeat from the second press and resets after 100 ms', () => {
      const s = scenario();
      const manager = new KeyPressManager(8);

      expect(manager.isPressed(backspace())).toBe(false);
      expect(manager.isPressed(backspace())).toBe(true);

      s.tick(100);

      expect(manager.isPressed(backspace())).toBe(false);

      manager.clear();
    });

    it('drops its reset timer when cleared mid-window', () => {
      scenario();
      const manager = new KeyPressManager(8);

      manager.isPressed(backspace());
      manager.isPressed(backspace());
      manager.clear();

      expect(vi.getTimerCount()).toBe(0);
      expect(manager.isPressed(backspace())).toBe(false);

      manager.clear();
    });
  });

  describe('controlValueSignal', () => {
    it('holds even the first value back for the debounce time with debounceFirst', () => {
      const s = scenario();
      const control = new FormControl('a');
      const value = s.consumer().run(() => controlValueSignal(control, { debounceTime: 100, debounceFirst: true }));

      expect(value()).toBeNull();

      s.tick(99);
      expect(value()).toBeNull();

      s.tick(1);
      expect(value()).toBe('a');

      control.setValue('b');
      s.tick(50);
      expect(value()).toBe('a');

      s.tick(50);
      expect(value()).toBe('b');
    });

    it('passes the first value through at once without debounceFirst', () => {
      const s = scenario();
      const control = new FormControl('a');
      const value = s.consumer().run(() => controlValueSignal(control, { debounceTime: 100 }));

      expect(value()).toBe('a');

      control.setValue('b');
      s.tick(99);
      expect(value()).toBe('a');

      s.tick(1);
      expect(value()).toBe('b');
    });

    it('drops a pending debounced value when its owner is destroyed', () => {
      const s = scenario();
      const control = new FormControl('a');
      const c = s.consumer();
      const value = c.run(() => controlValueSignal(control, { debounceTime: 100, debounceFirst: true }));

      control.setValue('b');
      s.tick(50);
      c.destroy();

      expect(vi.getTimerCount()).toBe(0);
      expect(value()).toBeNull();
    });
  });
});
