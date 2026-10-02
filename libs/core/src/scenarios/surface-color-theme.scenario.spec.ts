import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ColorTheme,
  ProvideColorDirective,
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

const surface = (name: string, type: SurfaceType, colorTheme?: string, isDefault = false): SurfaceTheme => ({
  name,
  type,
  elevation: 0,
  isDefault,
  colorTheme,
  background: type === 'light' ? '255 255 255' : '20 20 20',
  color: type === 'light' ? '0 0 0' : '255 255 255',
  colorMuted: '120 120 120',
  colorSubtle: '140 140 140',
  border: '160 160 160',
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'brand', isDefault: true, primary: swatch('96 165 250') },
  { name: 'brandOnLight', primary: swatch('29 78 216') },
  { name: 'accent', primary: swatch('200 0 120') },
];

const SURFACE_THEMES = [
  surface('night', 'dark', 'brand', true),
  surface('paper', 'light', 'brandOnLight'),
  surface('plain', 'light'),
  surface('broken', 'light', 'missing'),
];

@Component({
  selector: 'et-scenario-surface-color',
  imports: [ProvideSurfaceDirective, ProvideColorDirective],
  template: `
    <section class="root" etProvideSurface>
      <section class="paper" etProvideSurface="paper">
        <section class="inherits-paper" etProvideSurface></section>
        <section class="night-in-paper" etProvideSurface="night"></section>
        <section class="plain-in-paper" etProvideSurface="plain"></section>
      </section>
      <div etProvideColor="accent">
        <section class="paper-in-accent" etProvideSurface="paper"></section>
      </div>
      <div etProvideColor>
        <section class="paper-in-passive" etProvideSurface="paper"></section>
      </div>
      <section class="paper-with-accent" etProvideSurface="paper" etProvideColor="accent"></section>
      <section [etProvideSurface]="switchable()" class="switchable"></section>
    </section>
  `,
})
class SurfaceColorComponent {
  switchable = signal('plain');
}

const classesOf = (fixture: ComponentFixture<unknown>, selector: string) => {
  const element = (fixture.nativeElement as HTMLElement).querySelector(selector);

  if (!element) throw new Error(`${selector} is not rendered`);

  return [...element.classList].filter((name) => name.startsWith('et-color--'));
};

describe('surface color theme scenarios', () => {
  const scenario = useScenario({
    providers: [provideColorThemesWithTailwind4(COLOR_THEMES), provideSurfaceThemesWithTailwind4(SURFACE_THEMES)],
  });

  it('applies the color theme of the surface each provider resolves itself', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SurfaceColorComponent);
    s.tick();

    expect(classesOf(fixture, '.root')).toEqual(['et-color--brand']);
    expect(classesOf(fixture, '.paper')).toEqual(['et-color--brand-on-light']);
    expect(classesOf(fixture, '.night-in-paper')).toEqual(['et-color--brand']);
    expect(classesOf(fixture, '.inherits-paper')).toEqual([]);
    expect(classesOf(fixture, '.plain-in-paper')).toEqual([]);
  });

  it('leaves the theme of an [etProvideColor] on or above the surface in place', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SurfaceColorComponent);
    s.tick();

    expect(classesOf(fixture, '.paper-in-accent')).toEqual([]);
    expect(classesOf(fixture, '.paper-with-accent')).toEqual(['et-color--accent']);
    expect(classesOf(fixture, '.paper-in-passive')).toEqual(['et-color--brand-on-light']);
  });

  it('follows a surface that changes at runtime', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SurfaceColorComponent);
    s.tick();

    expect(classesOf(fixture, '.switchable')).toEqual([]);

    fixture.componentInstance.switchable.set('paper');
    s.tick();

    expect(classesOf(fixture, '.switchable')).toEqual(['et-color--brand-on-light']);
  });

  it('reports a surface that names an unregistered color theme', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SurfaceColorComponent);
    fixture.componentInstance.switchable.set('broken');
    s.tick();

    s.expectError(/names the color theme missing, which does not exist/);
  });
});
