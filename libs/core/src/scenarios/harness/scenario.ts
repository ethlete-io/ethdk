import {
  ApplicationRef,
  createEnvironmentInjector,
  DestroyRef,
  EnvironmentInjector,
  EnvironmentProviders,
  ErrorHandler,
  Provider,
  provideZonelessChangeDetection,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createApplication } from '@angular/platform-browser';
import { afterEach, beforeEach, vi } from 'vitest';
import { installFakeFrames } from './frames';
import { checkInvariants, InvariantName, ScenarioErrorEntry, ScenarioWarningEntry } from './invariants';
import { trackListeners } from './listeners';
import { installFakeIntersectionObserver } from './observers';

export type ScenarioProviders = (EnvironmentProviders | Provider)[];

export type ScenarioConfig = {
  /** Extra providers. A function runs inside `beforeEach`, for providers whose creation has side effects. */
  providers?: ScenarioProviders | (() => ScenarioProviders);
};

export type ScenarioConsumer = {
  injector: EnvironmentInjector;
  destroyRef: DestroyRef;
  run: <T>(fn: () => T) => T;
  destroy: () => void;
};

export type ScenarioApp = {
  appRef: ApplicationRef;
  injector: EnvironmentInjector;
  run: <T>(fn: () => T) => T;
  destroy: () => void;
};

export type Scenario = {
  injector: EnvironmentInjector;
  appRef: ApplicationRef;
  run: <T>(fn: () => T) => T;
  /** A fake component: its own child injector and `DestroyRef`, below `parent` (the scenario's root by default). */
  consumer: (providers?: ScenarioProviders, parent?: EnvironmentInjector) => ScenarioConsumer;
  /** A second Angular application on the same document, with an `ErrorHandler` that reports into `errors`. */
  app: (providers?: ScenarioProviders) => Promise<ScenarioApp>;
  /** Runs change detection, advances fake timers by `ms`, drains ticks, runs change detection again. */
  tick: (ms?: number) => void;
  /** Runs `count` animation frames, with change detection around each. */
  frame: (count?: number) => void;
  /** Runs frames and advances timers until neither has anything pending. */
  flush: (maxRounds?: number) => void;
  /** `flush` that also awaits promises between rounds. */
  settle: (maxRounds?: number) => Promise<void>;
  pendingFrames: () => number;
  keydown: (key: string, target?: EventTarget) => KeyboardEvent;
  /** Reports `target` as (not) intersecting to every fake `IntersectionObserver` observing it. */
  intersect: (target: Element, isIntersecting: boolean) => void;
  /** The elements some fake `IntersectionObserver` currently observes. */
  observedElements: () => Element[];
  errors: ScenarioErrorEntry[];
  expectError: (matcher: string | RegExp) => void;
  warnings: ScenarioWarningEntry[];
  expectWarning: (matcher: string | RegExp) => void;
  allow: (name: InvariantName, reason: string) => void;
  destroy: () => void;
};

const FRAME_MS = 16;

const buildScenario = (config: ScenarioConfig): Scenario => {
  const errors: ScenarioErrorEntry[] = [];
  const warnings: ScenarioWarningEntry[] = [];
  const allowed = new Set<InvariantName>();
  const consumers = new Set<EnvironmentInjector>();
  const apps = new Set<ScenarioApp>();
  const initialBodyChildren = new Set(Array.from(document.body.children));
  const errorHandler = { handleError: (error: unknown) => errors.push({ source: 'ErrorHandler', error }) };

  const frames = installFakeFrames();
  const listeners = trackListeners();
  const intersections = installFakeIntersectionObserver();

  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push({ source: 'console.error', error: args[0] });
  };

  const originalConsoleWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push({ source: 'console.warn', warning: args[0] });
  };

  const restoreGlobals = () => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    listeners.restore();
    frames.restore();
    intersections.restore();
  };

  try {
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useValue: errorHandler },
        ...(typeof config.providers === 'function' ? config.providers() : (config.providers ?? [])),
      ],
    });

    const injector = TestBed.inject(EnvironmentInjector);
    const appRef = TestBed.inject(ApplicationRef);

    const detectChanges = () => {
      TestBed.tick();
      apps.forEach((app) => app.appRef.tick());
    };

    const run = <T>(fn: () => T): T => TestBed.runInInjectionContext(fn);

    const tick = (ms = 0) => {
      detectChanges();
      vi.advanceTimersByTime(ms);
      vi.runAllTicks();
      detectChanges();
    };

    const frame = (count = 1) => {
      for (let i = 0; i < count; i++) {
        detectChanges();
        frames.run();
        detectChanges();
      }
    };

    const isIdle = () => frames.pending() === 0 && vi.getTimerCount() === 0;

    const flushError = (maxRounds: number) =>
      new Error(
        `Scenario: flush() did not settle within ${maxRounds} rounds (${frames.pending()} frame(s), ${vi.getTimerCount()} timer(s) pending)`,
      );

    const flush = (maxRounds = 200) => {
      for (let round = 0; round < maxRounds; round++) {
        if (isIdle()) return;
        frame();
        tick(FRAME_MS);
      }

      if (!isIdle()) throw flushError(maxRounds);
    };

    const settle = async (maxRounds = 200) => {
      for (let round = 0; round < maxRounds; round++) {
        for (let i = 0; i < 10; i++) await Promise.resolve();
        if (isIdle()) return;
        frame();
        tick(FRAME_MS);
      }

      if (!isIdle()) throw flushError(maxRounds);
    };

    const consumer = (providers: ScenarioProviders = [], parent: EnvironmentInjector = injector): ScenarioConsumer => {
      const childInjector = createEnvironmentInjector(providers, parent);

      consumers.add(childInjector);

      return {
        injector: childInjector,
        destroyRef: childInjector.get(DestroyRef),
        run: (fn) => childInjector.runInContext(fn),
        destroy: () => {
          consumers.delete(childInjector);
          childInjector.destroy();
        },
      };
    };

    const app = async (providers: ScenarioProviders = []): Promise<ScenarioApp> => {
      const secondAppRef = await createApplication({
        providers: [provideZonelessChangeDetection(), { provide: ErrorHandler, useValue: errorHandler }, ...providers],
      });

      const scenarioApp: ScenarioApp = {
        appRef: secondAppRef,
        injector: secondAppRef.injector,
        run: (fn) => secondAppRef.injector.runInContext(fn),
        destroy: () => {
          if (!apps.delete(scenarioApp)) return;
          secondAppRef.destroy();
        },
      };

      apps.add(scenarioApp);

      return scenarioApp;
    };

    const keydown = (key: string, target: EventTarget = document.activeElement ?? document.body) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

      target.dispatchEvent(event);
      detectChanges();

      return event;
    };

    const consume = <TEntry>(entries: TEntry[], matcher: string | RegExp, read: (entry: TEntry) => unknown) => {
      const index = entries.findIndex((entry) => {
        const text = String(read(entry));

        return typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text);
      });

      if (index === -1) {
        throw new Error(
          `Scenario: no captured entry matches ${String(matcher)} among ${entries.length}:\n${entries.map((entry) => String(read(entry))).join('\n')}`,
        );
      }

      entries.splice(index, 1);
    };

    const destroy = () => {
      try {
        Array.from(apps).forEach((scenarioApp) => scenarioApp.destroy());
        Array.from(consumers).forEach((childInjector) => {
          consumers.delete(childInjector);
          childInjector.destroy();
        });

        TestBed.resetTestingModule();

        // Angular's change detection scheduler arms a zero-delay timer after the last signal write.
        vi.advanceTimersByTime(1);
      } finally {
        restoreGlobals();
      }

      checkInvariants({
        pendingFrames: frames.pending(),
        observedElements: intersections.observed(),
        listeners: listeners.records(),
        initialBodyChildren,
        errors,
        warnings,
        allowed,
      });
    };

    return {
      injector,
      appRef,
      run,
      consumer,
      app,
      tick,
      frame,
      flush,
      settle,
      pendingFrames: frames.pending,
      keydown,
      intersect: (target, isIntersecting) => {
        intersections.intersect(target, isIntersecting);
        detectChanges();
      },
      observedElements: intersections.observed,
      errors,
      expectError: (matcher) => consume(errors, matcher, (entry) => entry.error),
      warnings,
      expectWarning: (matcher) => consume(warnings, matcher, (entry) => entry.warning),
      allow: (name) => allowed.add(name),
      destroy,
    };
  } catch (error) {
    restoreGlobals();
    throw error;
  }
};

const useFakeTimers = () =>
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });

/** Builds a scenario without registering hooks. The caller installs fake timers and calls `destroy()`. */
export const createScenario = (config: ScenarioConfig = {}) => buildScenario(config);

/** Registers `beforeEach`/`afterEach` that build a scenario on fake timers and check its invariants on teardown. */
export const useScenario = (config: ScenarioConfig = {}): (() => Scenario) => {
  let current: Scenario | null = null;

  beforeEach(() => {
    useFakeTimers();
    current = buildScenario(config);
  });

  afterEach(() => {
    try {
      current?.destroy();
    } finally {
      current = null;
      vi.useRealTimers();
    }
  });

  return () => {
    if (!current) throw new Error('Scenario: accessed outside of a running test');

    return current;
  };
};
