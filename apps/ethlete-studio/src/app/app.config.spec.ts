import { TestBed } from '@angular/core/testing';
import { injectColorThemes, injectSurfaceThemes } from '@ethlete/core';
import { vi } from 'vitest';
import { THEMES } from '../themes';
import { appConfig } from './app.config';

vi.mock('../host/window', () => ({ provideWindowChrome: () => [] }));

describe('appConfig themes', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: appConfig.providers }));

  it('registers exactly one default colour theme, Studio own', () => {
    const themes = TestBed.runInInjectionContext(() => injectColorThemes());
    const defaults = themes.filter((theme) => theme.isDefault).map((theme) => theme.name);

    expect(defaults).toEqual([THEMES.find((theme) => theme.isDefault)?.name]);
  });

  it('registers exactly one default surface theme', () => {
    const themes = TestBed.runInInjectionContext(() => injectSurfaceThemes());

    expect(themes.filter((theme) => theme.isDefault)).toHaveLength(1);
  });
});
