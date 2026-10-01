import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ColorTheme,
  provideColorThemesWithTailwind4,
  ProvideColorDirective,
  ProvideSurfaceDirective,
  provideSurfaceThemesWithTailwind4,
  SurfaceTheme,
  SurfaceType,
  ThemeSwatch,
} from '@ethlete/core';
import { describe, expect, it } from 'vitest';
import { QueryDevtoolsErrorThemeDirective } from './query-devtools-error-theme.directive';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const surface = (
  name: string,
  type: SurfaceType,
  semanticColorThemes?: SurfaceTheme['semanticColorThemes'],
): SurfaceTheme => ({
  name,
  type,
  elevation: 0,
  isDefault: name === 'night',
  semanticColorThemes,
  background: '20 20 20',
  color: '255 255 255',
  colorMuted: '120 120 120',
  colorSubtle: '140 140 140',
  border: '160 160 160',
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'brand', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('248 113 113') },
  { name: 'alertOnPaper', primary: swatch('153 27 27') },
];

@Component({
  imports: [ProvideSurfaceDirective, ProvideColorDirective, QueryDevtoolsErrorThemeDirective],
  template: `
    <section [etProvideSurface]="surface()">
      <p #errorTheme="etQueryDevtoolsErrorTheme" [etProvideColor]="errorTheme.theme()" etQueryDevtoolsErrorTheme>
        Broken
      </p>
    </section>
  `,
})
class HostComponent {
  surface = signal('paper');
}

describe('QueryDevtoolsErrorThemeDirective', () => {
  it('takes the error theme the surface names, and the error theme where it names none', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideColorThemesWithTailwind4(COLOR_THEMES),
        provideSurfaceThemesWithTailwind4([
          surface('night', 'dark'),
          surface('paper', 'light', { error: 'alertOnPaper' }),
        ]),
      ],
    });

    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const paragraph = (fixture.nativeElement as HTMLElement).querySelector('p');

    expect(paragraph?.classList).toContain('et-color--alert-on-paper');

    fixture.componentInstance.surface.set('night');
    await fixture.whenStable();

    expect(paragraph?.classList).toContain('et-color--alert');
  });
});
