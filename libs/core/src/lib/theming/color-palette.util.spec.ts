import { TestBed } from '@angular/core/testing';
import { injectColorPalette, provideColorPalette } from './color-palette.util';

describe('color palette', () => {
  it('is null when optional and not provided', () => {
    expect(TestBed.runInInjectionContext(() => injectColorPalette({ optional: true }))).toBeNull();
  });

  it('returns the provided entries in order', () => {
    const entries = [
      { token: 'brand', label: 'Team green' },
      { token: 'ocean', label: 'Training blue' },
    ];
    TestBed.configureTestingModule({ providers: [provideColorPalette(entries)] });

    expect(TestBed.runInInjectionContext(() => injectColorPalette({ optional: true }))).toEqual(entries);
  });
});
