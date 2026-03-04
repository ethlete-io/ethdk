import { createSecureQueryCreator } from './secure-query-creator';

describe('createSecureQueryCreator', () => {
  it('should be a function', () => {
    expect(typeof createSecureQueryCreator).toBe('function');
  });
});
