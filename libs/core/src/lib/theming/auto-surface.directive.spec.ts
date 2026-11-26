import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AutoSurfaceDirective } from './auto-surface.directive';
import { ProvideSurfaceDirective } from './provide-surface.directive';
import { provideSurfaceThemesWithTailwind4, SurfaceTheme } from './surface-theme.util';

const surface = (name: string, type: SurfaceTheme['type'], elevation: number, isDefault?: boolean): SurfaceTheme => ({
  name,
  type,
  elevation,
  isDefault,
  background: '0 0 0',
  color: '255 255 255',
  colorMuted: '180 180 180',
  colorSubtle: '80 80 80',
  border: '40 40 40',
});

const DARK = surface('dark', 'dark', 0, true);
const DARK_ELEVATED = surface('dark-elevated', 'dark', 1);
const DARK_ELEVATED_2 = surface('dark-elevated-2', 'dark', 2);
const LIGHT = surface('light', 'light', 0, true);
const LIGHT_ELEVATED = surface('light-elevated', 'light', 1);

const DARK_THEMES = [DARK, DARK_ELEVATED, DARK_ELEVATED_2];
const LIGHT_THEMES = [LIGHT, LIGHT_ELEVATED];

@Component({
  selector: 'et-auto-surface-host',
  template: `
    <div etAutoSurface>
      <div etAutoSurface></div>
    </div>
  `,
  imports: [AutoSurfaceDirective],
})
class NestedAutoSurfaceHostComponent {}

@Component({
  selector: 'et-passive-provider-host',
  template: `
    <div etProvideSurface>
      <div etAutoSurface></div>
    </div>
  `,
  imports: [AutoSurfaceDirective, ProvideSurfaceDirective],
})
class PassiveProviderHostComponent {}

@Component({
  selector: 'et-elevated-passive-provider-host',
  template: `
    <div etProvideSurface="dark-elevated">
      <div etProvideSurface>
        <div etAutoSurface></div>
      </div>
    </div>
  `,
  imports: [AutoSurfaceDirective, ProvideSurfaceDirective],
})
class ElevatedPassiveProviderHostComponent {}

describe('AutoSurfaceDirective', () => {
  const setup = <T>(component: new () => T, themes: SurfaceTheme[]) => {
    TestBed.configureTestingModule({ providers: [provideSurfaceThemesWithTailwind4(themes)] });

    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();

    const classesOf = (directive: typeof AutoSurfaceDirective | typeof ProvideSurfaceDirective) =>
      fixture.debugElement.queryAll(By.directive(directive)).map((el) => (el.nativeElement as HTMLElement).className);

    return { fixture, classesOf };
  };

  it('elevates the outermost auto-surface above the app default surface', () => {
    const { classesOf } = setup(NestedAutoSurfaceHostComponent, DARK_THEMES);

    expect(classesOf(AutoSurfaceDirective)[0]).toBe('et-surface--dark-elevated');
  });

  it('elevates a nested auto-surface above the outermost one', () => {
    const { classesOf } = setup(NestedAutoSurfaceHostComponent, DARK_THEMES);

    expect(classesOf(AutoSurfaceDirective)[1]).toBe('et-surface--dark-elevated-2');
  });

  it('resolves the app default surface type in a light-only app', () => {
    const { classesOf } = setup(NestedAutoSurfaceHostComponent, LIGHT_THEMES);

    expect(classesOf(AutoSurfaceDirective)[0]).toBe('et-surface--light-elevated');
  });

  it('elevates above the surface an unset parent provider inherits', () => {
    const { classesOf } = setup(PassiveProviderHostComponent, DARK_THEMES);

    expect(classesOf(AutoSurfaceDirective)[0]).toBe('et-surface--dark-elevated');
  });

  it('elevates above the elevated surface an unset parent provider inherits', () => {
    const { classesOf } = setup(ElevatedPassiveProviderHostComponent, DARK_THEMES);

    expect(classesOf(AutoSurfaceDirective)[0]).toBe('et-surface--dark-elevated-2');
  });

  it('leaves the outermost auto-surface inherited when the default surface is ambiguous', () => {
    const { classesOf } = setup(NestedAutoSurfaceHostComponent, [DARK, DARK_ELEVATED, LIGHT, LIGHT_ELEVATED]);

    expect(classesOf(AutoSurfaceDirective)[0]).toBe('et-surface--inherited');
  });
});
