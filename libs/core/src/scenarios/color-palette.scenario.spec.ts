import { Component, DebugElement } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ColorPaletteEntry,
  injectSurfaceColorPalette,
  provideColorPalette,
  provideColorThemesWithTailwind4,
  ProvideSurfaceDirective,
  provideSurfaceThemesWithTailwind4,
  SurfaceTheme,
  ThemeSwatch,
} from '../index';
import { useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const surface = (name: string, elevation: number, isDefault = false): SurfaceTheme => ({
  name,
  type: 'light',
  elevation,
  isDefault,
  background: '255 255 255',
  color: '0 0 0',
  colorMuted: '60 60 60',
  colorSubtle: '120 120 120',
  border: '200 200 200',
});

const COLOR_THEMES = [
  { name: 'brand', isDefault: true, primary: swatch('0 90 200') },
  { name: 'accent', primary: swatch('20 20 60') },
  { name: 'accentBright', primary: swatch('120 120 220') },
];

const SURFACE_THEMES = [surface('page', 0, true), surface('card', 1), surface('popover', 2)];

const DEFAULT_PALETTE: ColorPaletteEntry[] = [
  { token: 'brand', label: 'Team' },
  { token: 'accent', label: 'Training' },
];

const CARD_PALETTE: ColorPaletteEntry[] = [
  { token: 'brand', label: 'Team' },
  { token: 'accentBright', label: 'Training' },
];

@Component({
  selector: 'et-scenario-palette-reader',
  template: '',
})
class PaletteReaderComponent {
  palette = injectSurfaceColorPalette();
}

@Component({
  selector: 'et-scenario-palette-surfaces',
  imports: [ProvideSurfaceDirective, PaletteReaderComponent],
  template: `
    <et-scenario-palette-reader class="root" />
    <section etProvideSurface="page"><et-scenario-palette-reader class="on-page" /></section>
    <section etProvideSurface="card"><et-scenario-palette-reader class="on-card" /></section>
    <section etProvideSurface="popover"><et-scenario-palette-reader class="on-popover" /></section>
  `,
})
class PaletteSurfacesComponent {}

const readers = (fixture: { debugElement: DebugElement }) => {
  const read = (selector: string) => {
    const reader = fixture.debugElement.query((d) => d.nativeElement.matches?.(selector));

    if (!reader) throw new Error(`${selector} is not rendered`);

    return (reader.componentInstance as PaletteReaderComponent).palette();
  };

  return read;
};

const THEME_PROVIDERS = [
  provideColorThemesWithTailwind4(COLOR_THEMES),
  provideSurfaceThemesWithTailwind4(SURFACE_THEMES),
];

describe('color palette per surface scenarios', () => {
  const scenario = useScenario({
    providers: [...THEME_PROVIDERS, provideColorPalette({ default: DEFAULT_PALETTE, card: CARD_PALETTE })],
  });

  it('gives each surface its own list and falls back to the default list for a surface without one', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PaletteSurfacesComponent);
    s.tick();
    const read = readers(fixture);

    expect(read('.on-card')).toEqual(CARD_PALETTE);
    expect(read('.on-page')).toEqual(DEFAULT_PALETTE);
    expect(read('.on-popover')).toEqual(DEFAULT_PALETTE);
    expect(read('.root')).toEqual(DEFAULT_PALETTE);
  });
});

describe('color palette as a plain list scenarios', () => {
  const scenario = useScenario({ providers: [...THEME_PROVIDERS, provideColorPalette(CARD_PALETTE)] });

  it('hands every surface the one list', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PaletteSurfacesComponent);
    s.tick();
    const read = readers(fixture);

    expect(read('.on-card')).toEqual(CARD_PALETTE);
    expect(read('.on-page')).toEqual(CARD_PALETTE);
  });
});

describe('color palette absent scenarios', () => {
  const scenario = useScenario({ providers: THEME_PROVIDERS });

  it('reads null on every surface when the app provides no palette', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PaletteSurfacesComponent);
    s.tick();

    expect(readers(fixture)('.on-card')).toBeNull();
  });
});
