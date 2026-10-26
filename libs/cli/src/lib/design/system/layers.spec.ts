import { describe, expect, it } from 'vitest';
import { isLayer, mayUse } from './layers';

describe('layers', () => {
  it('lets each layer use only the layers below it, and components each other', () => {
    expect(mayUse({ from: 'foundations', to: 'foundations' })).toBe(false);
    expect(mayUse({ from: 'components', to: 'components' })).toBe(true);
    expect(mayUse({ from: 'components', to: 'elements' })).toBe(false);
    expect(mayUse({ from: 'elements', to: 'elements' })).toBe(false);
    expect(mayUse({ from: 'pages', to: 'elements' })).toBe(true);
    expect(mayUse({ from: 'pages', to: 'pages' })).toBe(false);
  });

  it('knows the four layer names', () => {
    expect(isLayer('pages')).toBe(true);
    expect(isLayer('calls')).toBe(false);
  });
});
