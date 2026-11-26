import { TestBed } from '@angular/core/testing';
import {
  createCssSurfaceName,
  injectDefaultSurfaceTheme,
  provideSurfaceThemesWithTailwind4,
  resolveSurfaceByElevation,
  SurfaceTheme,
} from './surface-theme.util';

const theme = (name: string, type: 'light' | 'dark', elevation: number, isDefault = false): SurfaceTheme => ({
  name,
  type,
  elevation,
  isDefault,
  background: '0 0 0',
  color: '0 0 0',
  colorMuted: '0 0 0',
  colorSubtle: '0 0 0',
  border: '0 0 0',
});

describe('surface theme util', () => {
  it('kebab-cases a css surface name', () => {
    expect(createCssSurfaceName('darkElevated')).toBe('dark-elevated');
    expect(createCssSurfaceName('card')).toBe('card');
  });

  it('resolves a surface by type and elevation, or null', () => {
    const themes = [theme('a', 'light', 0), theme('b', 'dark', 1)];

    expect(resolveSurfaceByElevation(themes, 'dark', 1)?.name).toBe('b');
    expect(resolveSurfaceByElevation(themes, 'light', 1)).toBeNull();
  });

  describe('injectDefaultSurfaceTheme', () => {
    const inject = (themes: SurfaceTheme[] | null, type?: 'light' | 'dark') => {
      TestBed.configureTestingModule({
        providers: themes ? [provideSurfaceThemesWithTailwind4(themes)] : [],
      });
      return TestBed.runInInjectionContext(() => injectDefaultSurfaceTheme(type));
    };

    it('is null when no themes are registered', () => {
      expect(inject(null)).toBeNull();
    });

    it('resolves the only default without a type', () => {
      expect(inject([theme('a', 'light', 0, true), theme('b', 'light', 1)])?.name).toBe('a');
    });

    it('is null without a type when both types have a default', () => {
      expect(inject([theme('a', 'light', 0, true), theme('b', 'dark', 0, true)])).toBeNull();
    });

    it('picks the default of the requested type', () => {
      expect(inject([theme('a', 'light', 0, true), theme('b', 'dark', 0, true)], 'dark')?.name).toBe('b');
    });
  });
});
