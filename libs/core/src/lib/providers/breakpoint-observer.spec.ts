import { TestBed } from '@angular/core/testing';
import { injectBreakpointObserver } from './breakpoint-observer';

describe('BreakpointObserver', () => {
  it('supports zero-valued bounds', () => {
    const observer = TestBed.runInInjectionContext(injectBreakpointObserver);

    expect(observer.buildMediaQueryString({ min: 0 })).toBe('(min-width: 0px)');
    expect(observer.buildMediaQueryString({ max: 0 })).toBe('(max-width: 0px)');
  });

  it('omits an unbounded maximum', () => {
    const observer = TestBed.runInInjectionContext(injectBreakpointObserver);

    expect(observer.buildMediaQueryString({ max: '2xl' })).toBe('(min-width: 0px)');
    expect(observer.buildMediaQueryString({ min: 'sm', max: '2xl' })).toBe('(min-width: 640px)');
  });
});
