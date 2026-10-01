import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ColorTheme,
  ProvideColorDirective,
  ProvideSurfaceDirective,
  provideColorThemesWithTailwind4,
  provideSurfaceThemesWithTailwind4,
  SurfaceTheme,
  SurfaceType,
} from '../index';
import { useScenario } from './harness';

const ALERT: ColorTheme = {
  name: 'alert',
  isDefault: true,
  primary: {
    color: { default: '220 38 38', hover: '239 68 68', active: '185 28 28', disabled: '120 52 52' },
    onColor: { default: '255 255 255' },
    inkColor: { default: '248 113 113' },
    inkColorBySurfaceType: { light: { default: '185 28 28' } },
  },
};

const surface = (name: string, type: SurfaceType): SurfaceTheme => ({
  name,
  type,
  elevation: 0,
  isDefault: true,
  background: type === 'light' ? '255 255 255' : '23 23 23',
  color: type === 'light' ? '23 23 23' : '250 250 250',
  colorMuted: '115 115 115',
  colorSubtle: '161 161 161',
  border: '64 64 64',
});

const RESOLVE_SCOPE = ':where([class*="et-color--"]), :where([class*="et-surface--"])';
const RESET_SCOPE = ':where([class*="et-color--"]:not(.et-color--inherited))';

@Component({
  selector: 'et-scenario-surface-ink',
  imports: [ProvideColorDirective, ProvideSurfaceDirective],
  template: `
    <div class="named" etProvideColor="alert">
      <section class="night" etProvideSurface="night">
        <div class="day" etProvideSurface="day">
          <span class="passive-color" etProvideColor></span>
          <span class="passive-surface" etProvideSurface></span>
          <span class="plain"></span>
        </div>
      </section>
    </div>
  `,
})
class SurfaceInkComponent {}

describe('surface-aware ink scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideColorThemesWithTailwind4([ALERT]),
      provideSurfaceThemesWithTailwind4([surface('night', 'dark'), surface('day', 'light')]),
    ],
  });

  it('marks every nested surface and color scope as a place the ink re-resolves', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SurfaceInkComponent);
    const host = fixture.nativeElement as HTMLElement;
    s.tick();

    const at = (selector: string) => {
      const element = host.querySelector(selector);

      if (!element) throw new Error(`${selector} is not rendered`);

      return element;
    };

    for (const selector of ['.named', '.night', '.day', '.passive-color', '.passive-surface']) {
      expect(at(selector).matches(RESOLVE_SCOPE)).toBe(true);
    }

    expect(at('.plain').matches(RESOLVE_SCOPE)).toBe(false);

    fixture.destroy();
  });

  it('resets the per-type ink on a named color scope but lets a passive one inherit it', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SurfaceInkComponent);
    const host = fixture.nativeElement as HTMLElement;
    s.tick();

    expect(host.querySelector('.named')?.matches(RESET_SCOPE)).toBe(true);
    expect(host.querySelector('.passive-color')?.matches(RESET_SCOPE)).toBe(false);

    const surfaceTypes = [...host.querySelectorAll('section, div.day')].map((element) =>
      fixture.debugElement
        .query((debug) => debug.nativeElement === element)
        ?.injector.get(ProvideSurfaceDirective)
        .surfaceType(),
    );

    expect(surfaceTypes).toEqual(['dark', 'light']);

    fixture.destroy();
  });
});
