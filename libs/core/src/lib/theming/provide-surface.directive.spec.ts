import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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

const NIGHT = surface('night', 'dark', 0, true);
const NIGHT_ELEVATED = surface('night-elevated', 'dark', 1);
const DAY = surface('day', 'light', 0, true);

@Component({
  selector: 'et-surface-host',
  template: `
    <div etProvideSurface>
      <div etProvideSurface></div>
    </div>
  `,
  imports: [ProvideSurfaceDirective],
})
class SurfaceHostComponent {}

describe('ProvideSurfaceDirective', () => {
  const setup = (themes: SurfaceTheme[]) => {
    TestBed.configureTestingModule({ providers: [provideSurfaceThemesWithTailwind4(themes)] });

    const fixture = TestBed.createComponent(SurfaceHostComponent);
    fixture.detectChanges();

    const [root, nested] = fixture.debugElement
      .queryAll(By.directive(ProvideSurfaceDirective))
      .map((el) => el.injector.get(ProvideSurfaceDirective));

    return { root: root!, nested: nested! };
  };

  it('resolves the registered default on the outermost provider', () => {
    const { root } = setup([NIGHT, NIGHT_ELEVATED]);

    expect(root.resolvedTheme()).toBe(NIGHT);
    expect(root.surfaceType()).toBe('dark');
    expect(root.elevation()).toBe(0);
  });

  it('keeps a nested provider inheriting instead of resetting it to the default', () => {
    const { nested } = setup([NIGHT, NIGHT_ELEVATED]);

    expect(nested.resolvedTheme()).toBeNull();
  });

  it('reports the surface an unset nested provider inherits', () => {
    const { root, nested } = setup([NIGHT, NIGHT_ELEVATED]);

    root.forceSurface('night-elevated');

    expect(nested.activeTheme()).toBe(NIGHT_ELEVATED);
    expect(nested.elevation()).toBe(1);
    expect(nested.surfaceType()).toBe('dark');
  });

  it('leaves the painted class inherited so the root surface comes from the stylesheet', () => {
    const { root } = setup([NIGHT, NIGHT_ELEVATED]);

    expect(root.surfaceName()).toBeUndefined();
  });

  it('leaves the root unresolved when both surface types are registered', () => {
    const { root } = setup([DAY, NIGHT]);

    expect(root.resolvedTheme()).toBeNull();
  });

  it('resolves an explicitly set surface over the default', () => {
    const { root, nested } = setup([NIGHT, NIGHT_ELEVATED]);

    nested.forceSurface('night-elevated');
    expect(nested.resolvedTheme()).toBe(NIGHT_ELEVATED);

    root.forceSurface('night-elevated');
    expect(root.resolvedTheme()).toBe(NIGHT_ELEVATED);
  });
});
