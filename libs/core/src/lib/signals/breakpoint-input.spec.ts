import { TestBed } from '@angular/core/testing';
import { numberBreakpointTransform, typedBreakpointTransform } from './breakpoint-input';

describe('breakpoint input transforms', () => {
  it('uses the declared input default below the first map key', () => {
    const result = TestBed.runInInjectionContext(() => numberBreakpointTransform(1)({ md: 3 }));

    expect(result).toBe(1);
  });

  it('does not require provideBreakpointInstance for initial resolution', () => {
    const result = TestBed.runInInjectionContext(() =>
      typedBreakpointTransform<'auto' | 'third'>('auto')({ lg: 'third' }),
    );

    expect(() => TestBed.tick()).not.toThrow();
    expect(result).toBe('auto');
  });
});
