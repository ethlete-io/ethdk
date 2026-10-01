import { Component, DebugElement, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ColorTheme,
  injectSemanticColorTheme,
  provideColorThemesWithTailwind4,
  ProvideSurfaceDirective,
  provideSurfaceThemesWithTailwind4,
  SurfaceTheme,
  SurfaceType,
  ThemeSwatch,
} from '../index';
import { useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const surface = (
  name: string,
  type: SurfaceType,
  semanticColorThemes?: SurfaceTheme['semanticColorThemes'],
  isDefault = false,
): SurfaceTheme => ({
  name,
  type,
  elevation: 0,
  isDefault,
  semanticColorThemes,
  background: type === 'light' ? '255 255 255' : '20 20 20',
  color: type === 'light' ? '0 0 0' : '255 255 255',
  colorMuted: '120 120 120',
  colorSubtle: '140 140 140',
  border: '160 160 160',
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'brand', isDefault: true, primary: swatch('0 90 200') },
  { name: 'done', type: 'success', primary: swatch('74 222 128') },
  { name: 'alert', type: 'error', primary: swatch('248 113 113') },
  { name: 'doneOnLight', primary: swatch('22 101 52') },
];

const SURFACE_THEMES = [
  surface('night', 'dark', undefined, true),
  surface('paper', 'light', { success: 'doneOnLight' }),
  surface('broken', 'light', { success: 'missing' }),
];

@Component({
  selector: 'et-scenario-semantic-reader',
  template: '',
})
class SemanticReaderComponent {
  success = injectSemanticColorTheme('success');
  error = injectSemanticColorTheme('error');
}

@Component({
  selector: 'et-scenario-semantic-surfaces',
  imports: [ProvideSurfaceDirective, SemanticReaderComponent],
  template: `
    <et-scenario-semantic-reader class="root" />
    <section etProvideSurface="paper">
      <et-scenario-semantic-reader class="on-paper" />
      <section etProvideSurface><et-scenario-semantic-reader class="inherits-paper" /></section>
      <section etProvideSurface="night"><et-scenario-semantic-reader class="night-in-paper" /></section>
    </section>
    <section etProvideSurface="night">
      <section etProvideSurface="paper"><et-scenario-semantic-reader class="paper-in-night" /></section>
    </section>
    <section [etProvideSurface]="switchable()"><et-scenario-semantic-reader class="switchable" /></section>
  `,
})
class SemanticSurfacesComponent {
  switchable = signal('night');
}

const reader = (fixture: { debugElement: DebugElement }, selector: string) => {
  const element = fixture.debugElement.query((d) => d.nativeElement.matches?.(selector));

  if (!element) throw new Error(`${selector} is not rendered`);

  return element.componentInstance as SemanticReaderComponent;
};

const THEME_PROVIDERS = [
  provideColorThemesWithTailwind4(COLOR_THEMES),
  provideSurfaceThemesWithTailwind4(SURFACE_THEMES),
];

describe('semantic color theme per surface scenarios', () => {
  const scenario = useScenario({ providers: THEME_PROVIDERS });

  it('takes the theme the nearest surface names, through nesting and inherited providers', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SemanticSurfacesComponent);
    s.tick();

    expect(reader(fixture, '.on-paper').success().name).toBe('doneOnLight');
    expect(reader(fixture, '.inherits-paper').success().name).toBe('doneOnLight');
    expect(reader(fixture, '.paper-in-night').success().name).toBe('doneOnLight');
    expect(reader(fixture, '.night-in-paper').success().name).toBe('done');
    expect(reader(fixture, '.root').success().name).toBe('done');
  });

  it('falls back to the first theme of the type where the surface maps nothing for it', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SemanticSurfacesComponent);
    s.tick();

    expect(reader(fixture, '.on-paper').error().name).toBe('alert');
  });

  it('follows a surface that changes at runtime', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SemanticSurfacesComponent);
    s.tick();
    const switchable = reader(fixture, '.switchable');

    expect(switchable.success().name).toBe('done');

    fixture.componentInstance.switchable.set('paper');
    s.tick();

    expect(switchable.success().name).toBe('doneOnLight');
  });

  it('reports a surface that maps a type to an unregistered theme, and falls back', () => {
    const s = scenario();
    const theme = s.run(() => injectSemanticColorTheme('success'));
    const fixture = TestBed.createComponent(SemanticSurfacesComponent);
    fixture.componentInstance.switchable.set('broken');
    s.tick();

    expect(reader(fixture, '.switchable').success().name).toBe('done');
    s.expectError(/maps "success" to the color theme "missing"/);
    expect(theme().name).toBe('done');
  });

  it('throws on read where the app registered no theme of the type', () => {
    const s = scenario();
    const bare = s.consumer([provideColorThemesWithTailwind4([COLOR_THEMES[0] as ColorTheme])]);
    const warning = bare.run(() => injectSemanticColorTheme('warning'));

    expect(() => warning()).toThrow(/No color theme with type "warning"/);
  });
});
