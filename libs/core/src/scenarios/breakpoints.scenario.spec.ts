import { Component, computed, effect } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  injectBreakpointIsMatched,
  injectCanHover,
  injectCurrentBreakpoint,
  injectIsSm,
  injectIsXs,
  injectObserveBreakpoint,
  injectObserveMediaQuery,
  provideViewportConfig,
} from '../index';
import { createScenario, useScenario } from './harness';

type Listener = (event: { matches: boolean; media: string }) => void;

const createFakeMedia = (initial: { width: number; hover: boolean }) => {
  const env = { ...initial };
  const lists: { media: string; matches: boolean; listeners: Set<Listener> }[] = [];

  const evaluate = (media: string) =>
    media.split(' and ').every((part) => {
      const [, feature, value] = /^\(([\w-]+):\s*([\w.]+?)(px)?\)$/.exec(part.trim()) ?? [];

      if (feature === 'min-width') return env.width >= Number(value);
      if (feature === 'max-width') return env.width <= Number(value);
      if (feature === 'hover') return env.hover === (value === 'hover');

      throw new Error(`fake matchMedia cannot evaluate ${part}`);
    });

  const matchMedia = (media: string) => {
    const entry = { media, matches: evaluate(media), listeners: new Set<Listener>() };

    lists.push(entry);

    return {
      media,
      get matches() {
        return entry.matches;
      },
      addEventListener: (_: 'change', listener: Listener) => entry.listeners.add(listener),
      removeEventListener: (_: 'change', listener: Listener) => entry.listeners.delete(listener),
    };
  };

  const update = (next: Partial<typeof env>) => {
    Object.assign(env, next);

    for (const entry of lists) {
      const matches = evaluate(entry.media);

      if (matches === entry.matches) continue;

      entry.matches = matches;
      entry.listeners.forEach((listener) => listener({ matches, media: entry.media }));
    }
  };

  const install = () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });

    return () => Reflect.deleteProperty(window, 'matchMedia');
  };

  return {
    install,
    update,
    queries: () => lists.map((entry) => entry.media),
    listenerCount: () => lists.reduce((sum, entry) => sum + entry.listeners.size, 0),
  };
};

let media = createFakeMedia({ width: 1024, hover: true });
let uninstall = () => false;

const layoutLog: string[] = [];

@Component({ selector: 'et-scenario-layout', template: '' })
class LayoutComponent {
  isDesktop = injectObserveBreakpoint({ min: 'md' });
  isWide = injectObserveBreakpoint({ min: 'lg' });
  breakpoint = injectCurrentBreakpoint();
  isXs = injectIsXs();
  isSm = injectIsSm();
  canHover = injectCanHover();
  startedDesktop = injectBreakpointIsMatched({ min: 'md' });
  columns = computed(() => (this.isWide() ? 3 : this.isDesktop() ? 2 : 1));

  constructor() {
    effect(() => layoutLog.push(`${this.breakpoint()}:${this.columns()}`));
  }
}

describe('breakpoint scenarios', () => {
  beforeEach(() => {
    media = createFakeMedia({ width: 1024, hover: true });
    uninstall = media.install();
    layoutLog.length = 0;
  });

  afterEach(() => uninstall());

  describe('with the default viewport config', () => {
    const scenario = useScenario();

    it('follows the viewport across breakpoints, one layout per change', () => {
      const s = scenario();
      const fixture = TestBed.createComponent(LayoutComponent);

      s.tick();

      const layout = fixture.componentInstance;

      expect(layout.breakpoint()).toBe('lg');
      expect(layout.startedDesktop).toBe(true);
      expect(layout.canHover()).toBe(true);

      media.update({ width: 800 });
      s.tick();

      expect(layout.breakpoint()).toBe('md');
      expect(layout.columns()).toBe(2);

      media.update({ width: 700 });
      s.tick();

      expect(layout.isSm()).toBe(true);
      expect(layout.isDesktop()).toBe(false);

      media.update({ width: 320, hover: false });
      s.tick();

      expect(layout.isXs()).toBe(true);
      expect(layout.canHover()).toBe(false);
      expect(layout.startedDesktop).toBe(true);
      expect(layoutLog).toEqual(['lg:3', 'md:2', 'sm:1', 'xs:1']);

      fixture.destroy();
    });

    it('matches a fractional viewport width between two breakpoints', () => {
      const s = scenario();

      media.update({ width: 767.5 });

      const breakpoint = s.consumer().run(() => injectCurrentBreakpoint());

      expect(breakpoint()).toBe('sm');
    });

    it('shares one media query list between every component observing the same breakpoint', () => {
      const s = scenario();
      const first = TestBed.createComponent(LayoutComponent);
      const second = TestBed.createComponent(LayoutComponent);

      s.tick();

      const minMd = media.queries().filter((query) => query === '(min-width: 768px)');

      expect(minMd).toHaveLength(1);
      expect(first.componentInstance.isDesktop).toBe(second.componentInstance.isDesktop);

      first.destroy();
      media.update({ width: 500 });
      s.tick();

      expect(second.componentInstance.isDesktop()).toBe(false);

      second.destroy();
    });
  });

  describe('with an app-specific viewport config', () => {
    const scenario = useScenario({
      providers: [
        provideViewportConfig({
          breakpoints: {
            xs: [0, 479],
            sm: [480, 899],
            md: [900, 1199],
            lg: [1200, 1439],
            xl: [1440, 1919],
            '2xl': [1920, Infinity],
          },
        }),
      ],
    });

    it('builds its media queries from the provided breakpoints', () => {
      const s = scenario();
      const c = s.consumer();
      const isDesktop = c.run(() => injectObserveBreakpoint({ min: 'md' }));
      const breakpoint = c.run(() => injectCurrentBreakpoint());

      expect(isDesktop()).toBe(true);
      expect(breakpoint()).toBe('md');

      media.update({ width: 899.5 });
      s.tick();

      expect(isDesktop()).toBe(false);
      expect(breakpoint()).toBe('sm');
      expect(media.queries()).toContain('(min-width: 900px)');
    });
  });

  it('removes every media query listener when the app is destroyed', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });

    try {
      const s = createScenario();
      const c = s.consumer();

      c.run(() => {
        injectCurrentBreakpoint();
        injectObserveMediaQuery('(hover: hover)');
      });

      expect(media.listenerCount()).toBe(7);

      s.destroy();

      expect(media.listenerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
