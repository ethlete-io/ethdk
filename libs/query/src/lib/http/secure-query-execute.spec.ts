import { createSecureExecuteFn } from './secure-query-execute';

describe('createSecureExecuteFn', () => {
  it('should be a function', () => {
    expect(typeof createSecureExecuteFn).toBe('function');
  });
});
