import { Component, Directive } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { injectColorPalette, injectSurfaceColorPalette, provideColorPalette } from './color-palette.util';
import { ProvideSurfaceDirective } from './provide-surface.directive';
import { provideSurfaceThemesWithTailwind4, SurfaceTheme } from './surface-theme.util';

const surface = (name: string, elevation: number, isDefault?: boolean): SurfaceTheme => ({
  name,
  type: 'light',
  elevation,
  isDefault,
  background: '255 255 255',
  color: '0 0 0',
  colorMuted: '80 80 80',
  colorSubtle: '180 180 180',
  border: '220 220 220',
});

const LIGHT = [
  { token: 'ocean', label: 'Training' },
  { token: 'forest', label: 'Match' },
];
const DARK_CARD = [
  { token: 'ocean-bright', label: 'Training' },
  { token: 'forest-bright', label: 'Match' },
];

@Directive({ selector: '[etPaletteProbe]' })
class PaletteProbeDirective {
  palette = injectSurfaceColorPalette();
}

@Component({
  selector: 'et-palette-host',
  template: `
    <span etPaletteProbe></span>
    <div etProvideSurface="dark-card"><span etPaletteProbe></span></div>
    <div etProvideSurface="sheet"><span etPaletteProbe></span></div>
  `,
  imports: [PaletteProbeDirective, ProvideSurfaceDirective],
})
class PaletteHostComponent {}

const renderProbes = () => {
  const fixture = TestBed.createComponent(PaletteHostComponent);
  fixture.detectChanges();

  return fixture.debugElement
    .queryAll(By.directive(PaletteProbeDirective))
    .map((element) => element.injector.get(PaletteProbeDirective).palette());
};

describe('color palette', () => {
  it('is null when optional and not provided', () => {
    expect(TestBed.runInInjectionContext(() => injectColorPalette({ optional: true }))).toBeNull();
  });

  it('returns the provided entries in order', () => {
    TestBed.configureTestingModule({ providers: [provideColorPalette(LIGHT)] });

    expect(TestBed.runInInjectionContext(() => injectColorPalette({ optional: true }))).toEqual(LIGHT);
  });

  it('returns the default list when the palette has one list per surface', () => {
    TestBed.configureTestingModule({ providers: [provideColorPalette({ default: LIGHT, 'dark-card': DARK_CARD })] });

    expect(TestBed.runInInjectionContext(() => injectColorPalette())).toEqual(LIGHT);
  });
});

describe('surface color palette', () => {
  const themes = [surface('page', 0, true), surface('dark-card', 1), surface('sheet', 2)];

  it('takes the list of the surface it sits on, else the default list', () => {
    TestBed.configureTestingModule({
      providers: [
        provideSurfaceThemesWithTailwind4(themes),
        provideColorPalette({ default: LIGHT, 'dark-card': DARK_CARD }),
      ],
    });

    expect(renderProbes()).toEqual([LIGHT, DARK_CARD, LIGHT]);
  });

  it('takes the single list on every surface', () => {
    TestBed.configureTestingModule({
      providers: [provideSurfaceThemesWithTailwind4(themes), provideColorPalette(LIGHT)],
    });

    expect(renderProbes()).toEqual([LIGHT, LIGHT, LIGHT]);
  });

  it('is null when no palette is provided', () => {
    TestBed.configureTestingModule({ providers: [provideSurfaceThemesWithTailwind4(themes)] });

    expect(renderProbes()).toEqual([null, null, null]);
  });
});
