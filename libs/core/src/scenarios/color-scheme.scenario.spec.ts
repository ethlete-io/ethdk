import { Component, DOCUMENT, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ColorTheme,
  injectColorScheme,
  injectRootSurfaceTheme,
  injectSurfaceType,
  provideColorScheme,
  ProvideColorDirective,
  provideColorThemesWithTailwind4,
  ProvideSurfaceDirective,
  provideSurfaceThemesWithTailwind4,
  SurfaceTheme,
  ThemeSwatch,
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

const swatch: ThemeSwatch = {
  color: { default: '0 0 0', hover: '0 0 0', active: '0 0 0', disabled: '0 0 0' },
  onColor: { default: '0 0 0' },
};

const COLOR_THEMES: ColorTheme[] = [
  { name: 'brand', isDefault: true, primary: swatch },
  { name: 'brandOnLight', primary: swatch },
  { name: 'grey', primary: swatch },
  { name: 'greyLight', primary: swatch },
];

const SWAPPING_SCHEMES = [
  { ...surface('day', 'light'), colorThemeVariants: { brand: 'brandOnLight', grey: 'greyLight' } },
  surface('night', 'dark'),
];

@Component({
  selector: 'et-scenario-scheme-root-swap',
  imports: [ProvideSurfaceDirective, ProvideColorDirective],
  template: `
    <section class="day" etProvideSurface="day"></section>
    <section class="night" etProvideSurface="night"></section>
    <div class="grey" etProvideColor="grey"></div>
  `,
})
class RootSwapComponent {
  colorScheme = injectColorScheme();
  root = inject(DOCUMENT).documentElement;
}

const colorClasses = (element: Element) =>
  [...element.classList].filter((name) => name.startsWith('et-color--') && name !== 'et-color--inherited');

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

  describe('hydrating over a server render', () => {
    const scenario = useScenario();

    it('removes the accent swap the server painted when the client resolves to dark', async () => {
      const root = document.documentElement;

      root.classList.add('et-color--brand-on-light', 'et-color--grey-light');
      media.setPrefersDark(true);

      const s = scenario();
      const app = await s.app([
        provideColorThemesWithTailwind4(COLOR_THEMES),
        provideSurfaceThemesWithTailwind4(SWAPPING_SCHEMES),
        provideColorScheme(),
      ]);

      s.tick();

      expect(colorClasses(root)).toEqual(['et-color--grey-light']);

      app.run(() => injectColorScheme()).setMode('light');
      s.tick();

      expect(colorClasses(root)).toEqual(['et-color--grey-light', 'et-color--brand-on-light']);

      app.destroy();
      root.classList.remove('et-color--grey-light');
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

  describe('with colorThemeVariants on the root surface', () => {
    const scenario = useScenario({
      providers: [
        provideColorThemesWithTailwind4(COLOR_THEMES),
        provideSurfaceThemesWithTailwind4(SWAPPING_SCHEMES),
        provideColorScheme(),
      ],
    });

    it('paints the root surface swap of the default accent on <html> and follows the scheme', () => {
      const s = scenario();
      const app = TestBed.createComponent(RootSwapComponent).componentInstance;
      s.tick();

      expect(colorClasses(app.root)).toEqual(['et-color--brand-on-light']);

      app.colorScheme.setMode('dark');
      s.tick();

      expect(colorClasses(app.root)).toEqual([]);

      app.colorScheme.setMode('light');
      s.tick();

      expect(colorClasses(app.root)).toEqual(['et-color--brand-on-light']);
    });

    it('swaps outermost surfaces and colors against the root surface', () => {
      const s = scenario();
      const fixture = TestBed.createComponent(RootSwapComponent);
      s.tick();

      const query = (selector: string) => colorClasses((fixture.nativeElement as HTMLElement).querySelector(selector)!);

      expect(query('.day')).toEqual([]);
      expect(query('.night')).toEqual(['et-color--brand']);
      expect(query('.grey')).toEqual(['et-color--grey-light']);

      fixture.componentInstance.colorScheme.setMode('dark');
      s.tick();

      expect(query('.day')).toEqual(['et-color--brand-on-light']);
      expect(query('.night')).toEqual([]);
      expect(query('.grey')).toEqual(['et-color--grey']);
    });
  });
});
