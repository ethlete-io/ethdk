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

  it('warns once per transform when a map is bound without provideBreakpointInstance', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const transform = TestBed.runInInjectionContext(() => numberBreakpointTransform(1));

    transform({ md: 3 });
    TestBed.tick();
    transform({ md: 4 });
    TestBed.tick();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('provideBreakpointInstance');

    warn.mockRestore();
  });

  it('logs the unknown-key warning once per write', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const transform = TestBed.runInInjectionContext(() => numberBreakpointTransform(1));

    transform({ md: 3, nope: 2 } as never);
    TestBed.tick();

    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('stays quiet for plain values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const transform = TestBed.runInInjectionContext(() => numberBreakpointTransform(1));

    expect(transform(4)).toBe(4);
    TestBed.tick();

    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});
