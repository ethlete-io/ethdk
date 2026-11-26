import { ErrorHandler, inject } from '@angular/core';
import { reserveOverlayViewportSpace } from '../../index';
import { createScenario, useScenario } from './index';

const withFakeTimers = (fn: () => void) => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });

  try {
    fn();
  } finally {
    vi.useRealTimers();
  }
};

const expectDestroyToFail = (arrange: (s: ReturnType<typeof createScenario>) => void, message: RegExp) =>
  withFakeTimers(() => {
    const s = createScenario();

    arrange(s);

    expect(() => s.destroy()).toThrow(message);
  });

describe('scenario harness', () => {
  describe('a clean scenario', () => {
    const scenario = useScenario();

    it('runs frames only when told to', () => {
      const s = scenario();
      const calls: number[] = [];

      requestAnimationFrame(() => {
        calls.push(1);
        requestAnimationFrame(() => calls.push(2));
      });

      expect(s.pendingFrames()).toBe(1);

      s.frame();
      expect(calls).toEqual([1]);

      s.frame();
      expect(calls).toEqual([1, 2]);
      expect(s.pendingFrames()).toBe(0);
    });

    it('stamps each frame with the faked clock', () => {
      const s = scenario();
      const stamps: number[] = [];
      const start = performance.now();

      requestAnimationFrame((time) => stamps.push(time));
      s.tick(40);
      requestAnimationFrame((time) => stamps.push(time));
      s.frame();

      expect(stamps).toEqual([start + 40, start + 40]);
    });

    it('flushes frames and timers until nothing is pending', () => {
      const s = scenario();
      let done = false;

      setTimeout(() => requestAnimationFrame(() => setTimeout(() => (done = true), 100)), 50);

      s.flush();

      expect(done).toBe(true);
    });

    it('lets a once listener leave the record when it fires', () => {
      const s = scenario();

      document.addEventListener('click', () => undefined, { once: true });
      document.body.click();

      expect(s.errors).toEqual([]);
    });

    it('reports intersections only for observed elements', () => {
      const s = scenario();
      const observed = document.createElement('div');
      const other = document.createElement('div');
      const entries: [Element, boolean][] = [];
      const observer = new IntersectionObserver((batch) =>
        batch.forEach((entry) => entries.push([entry.target, entry.isIntersecting])),
      );

      observer.observe(observed);
      s.intersect(observed, true);
      s.intersect(other, true);

      expect(entries).toEqual([[observed, true]]);
      expect(s.observedElements()).toEqual([observed]);

      observer.disconnect();
    });

    it('does not count the listeners jsdom adds when a parsed document is first queried', () => {
      scenario();

      new DOMParser().parseFromString('<p></p>', 'text/html').querySelectorAll('p');
    });

    it('consumes an expected error', () => {
      const s = scenario();

      s.run(() => inject(ErrorHandler)).handleError(new Error('boom'));
      s.expectError(/boom/);
    });
  });

  describe('invariants', () => {
    it('names a leaked timer', () => expectDestroyToFail(() => setTimeout(() => undefined, 1000), /timers: 1 timer/));

    it('names a pending frame', () =>
      expectDestroyToFail(() => requestAnimationFrame(() => undefined), /frames: 1 animation frame/));

    it('names an element still observed', () =>
      expectDestroyToFail(
        () => new IntersectionObserver(() => undefined).observe(document.createElement('section')),
        /observers: 1 element\(s\) still observed by an IntersectionObserver: <section>/,
      ));

    it('names a leftover document listener', () =>
      expectDestroyToFail(
        () => document.addEventListener('keydown', () => undefined, true),
        /listeners: 1 listener.*document "keydown" \(capture\)/,
      ));

    it('names a leftover window listener', () =>
      expectDestroyToFail(() => window.addEventListener('resize', () => undefined), /window "resize"/));

    it('names a leftover overlay root and body child', () =>
      expectDestroyToFail(() => {
        const root = document.createElement('div');
        root.classList.add('et-overlay-runtime-root');
        document.body.appendChild(root);
        onTestFinished(() => root.remove());
      }, /overlay-roots: 1[\s\S]*body: 1 body child\(ren\) added and left: <div\.et-overlay-runtime-root>/));

    it('names a head child added and left', () =>
      expectDestroyToFail(() => {
        const meta = document.createElement('meta');
        document.head.appendChild(meta);
        onTestFinished(() => meta.remove());
      }, /head: 1 head child\(ren\) added and left: <meta>/));

    it('names a viewport reservation left set', () => {
      let release = () => undefined as void;

      expectDestroyToFail(() => {
        release = reserveOverlayViewportSpace({ bottom: 100 });
      }, /viewport-insets: reservations still active: \{"top":0,"right":0,"bottom":100,"left":0\}/);

      release();
    });

    it('names an error that reached the ErrorHandler', () =>
      expectDestroyToFail(
        (s) => s.run(() => inject(ErrorHandler)).handleError(new Error('unhandled')),
        /errors: 1 unexpected error\(s\):\n\[ErrorHandler\] Error: unhandled/,
      ));

    it('names an unexpected warning', () =>
      expectDestroyToFail(() => console.warn('careful'), /warnings: 1 unexpected warning\(s\):\ncareful/));

    it('skips an allowed invariant', () =>
      withFakeTimers(() => {
        const s = createScenario();

        setTimeout(() => undefined, 1000);
        s.allow('timers', 'harness self-test');

        expect(() => s.destroy()).not.toThrow();
      }));

    it('hands the patched globals back', () =>
      withFakeTimers(() => {
        const originalAdd = document.addEventListener;
        const originalFrame = globalThis.requestAnimationFrame;
        const originalObserver = globalThis.IntersectionObserver;
        const s = createScenario();

        expect(document.addEventListener).not.toBe(originalAdd);

        s.destroy();

        expect(document.addEventListener).toBe(originalAdd);
        expect(globalThis.requestAnimationFrame).toBe(originalFrame);
        expect(globalThis.IntersectionObserver).toBe(originalObserver);
      }));
  });
});
