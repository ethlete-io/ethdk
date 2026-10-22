import { Component, DOCUMENT, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  injectColorScheme,
  injectRootSurfaceTheme,
  injectSurfaceType,
  provideColorScheme,
  provideSurfaceThemesWithTailwind4,
  SurfaceTheme,
} from '../index';
import { useScenario } from './harness';

type Listener = (event: { matches: boolean; media: string }) => void;

const createFakeColorSchemeMedia = (initial: { prefersDark: boolean }) => {
  const env = { ...initial };
  const lists: { media: string; matches: boolean; listeners: Set<Listener> }[] = [];

  const evaluate = (media: string) => {
    if (media === '(prefers-color-scheme: dark)') return env.prefersDark;

    throw new Error(`fake matchMedia cannot evaluate ${media}`);
  };

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

  const setPrefersDark = (prefersDark: boolean) => {
    env.prefersDark = prefersDark;

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

  return { install, setPrefersDark };
};

const surface = (name: string, type: 'light' | 'dark'): SurfaceTheme => ({
  name,
  type,
  elevation: 0,
  isDefault: true,
  background: '0 0 0',
  color: '0 0 0',
  colorMuted: '0 0 0',
  colorSubtle: '0 0 0',
  border: '0 0 0',
});

const BOTH_SCHEMES = [surface('day', 'light'), surface('night', 'dark')];

@Component({ selector: 'et-scenario-scheme-switch', template: '' })
class SchemeSwitchComponent {
  colorScheme = injectColorScheme();
  rootSurface = injectRootSurfaceTheme();
  surfaceType = injectSurfaceType();
  root = inject(DOCUMENT).documentElement;
}

@Component({ selector: 'et-scenario-scheme-unprovided', template: '' })
class UnprovidedComponent {
  rootSurface = injectRootSurfaceTheme();
  surfaceType = injectSurfaceType();
}

let media = createFakeColorSchemeMedia({ prefersDark: false });
let uninstall = () => false;

describe('color scheme scenarios', () => {
  beforeEach(() => {
    media = createFakeColorSchemeMedia({ prefersDark: false });
    uninstall = media.install();
  });

  afterEach(() => uninstall());

  describe('with provideColorScheme()', () => {
    const scenario = useScenario({
      providers: [provideSurfaceThemesWithTailwind4(BOTH_SCHEMES), provideColorScheme()],
    });

    it('follows the OS in system mode, then a class on <html> overrides it', () => {
      const s = scenario();
      const fixture = TestBed.createComponent(SchemeSwitchComponent);
      const app = fixture.componentInstance;

      s.tick();

      expect(app.colorScheme.mode()).toBe('system');
      expect(app.surfaceType()).toBe('light');
      expect(app.rootSurface()?.name).toBe('day');

      media.setPrefersDark(true);
      s.tick();

      expect(app.surfaceType()).toBe('dark');
      expect(app.root.classList.contains('et-scheme--dark')).toBe(false);

      app.colorScheme.setMode('light');
      s.tick();

      expect(app.root.classList.contains('et-scheme--light')).toBe(true);
      expect(app.surfaceType()).toBe('light');
      expect(app.rootSurface()?.name).toBe('day');

      app.colorScheme.setMode('dark');
      s.tick();

      expect(app.root.classList.contains('et-scheme--light')).toBe(false);
      expect(app.root.classList.contains('et-scheme--dark')).toBe(true);
      expect(app.surfaceType()).toBe('dark');

      app.colorScheme.setMode('system');
      s.tick();

      expect(app.root.classList.contains('et-scheme--dark')).toBe(false);
      expect(app.surfaceType()).toBe('dark');

      fixture.destroy();
    });
  });

  describe('with a start mode', () => {
    const scenario = useScenario({
      providers: [provideSurfaceThemesWithTailwind4(BOTH_SCHEMES), provideColorScheme({ mode: 'dark' })],
    });

    it('puts the class on <html> before the first component renders', () => {
      scenario();

      expect(TestBed.inject(DOCUMENT).documentElement.classList.contains('et-scheme--dark')).toBe(true);
    });

    it('removes the class when the app is destroyed', () => {
      scenario();

      const root = TestBed.inject(DOCUMENT).documentElement;

      TestBed.resetTestingModule();

      expect(root.classList.contains('et-scheme--dark')).toBe(false);
    });
  });

  describe('without provideColorScheme()', () => {
    const scenario = useScenario({ providers: [provideSurfaceThemesWithTailwind4(BOTH_SCHEMES)] });

    it('cannot tell which default the root paints', () => {
      const s = scenario();
      const fixture = TestBed.createComponent(UnprovidedComponent);

      s.tick();

      expect(fixture.componentInstance.rootSurface()).toBeNull();
      expect(fixture.componentInstance.surfaceType()).toBeNull();

      fixture.destroy();
    });
  });
});
