import { describe, expect, it } from 'vitest';
import { svgAsset } from '../../../design/define-part';

describe('svgAsset', () => {
  it('replaces the width and height of the root svg and keeps the viewBox', () => {
    const raw =
      '<svg xmlns="http://www.w3.org/2000/svg" height="32" viewBox="0 0 32 32" width="32"><rect width="4" height="4"/></svg>';

    expect(svgAsset(raw, { size: 16 })).toBe(
      '<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="4" height="4"/></svg>',
    );
  });

  it('adds width and height when the root svg has none', () => {
    expect(svgAsset('<svg viewBox="0 0 8 8"><path d="M0 0h8"/></svg>', { size: '2rem' })).toBe(
      '<svg width="2rem" height="2rem" viewBox="0 0 8 8"><path d="M0 0h8"/></svg>',
    );
  });

  it('skips the xml prolog and comments before the root, and attributes across lines', () => {
    const raw = '<?xml version="1.0"?>\n<!-- <svg width="1"> -->\n<svg\n  width=\'24\'\n  viewBox="0 0 24 24"\n/>';

    expect(svgAsset(raw, { size: 48 })).toBe(
      '<?xml version="1.0"?>\n<!-- <svg width="1"> -->\n<svg width="48" height="48"\n  viewBox="0 0 24 24"\n/>',
    );
  });

  it('throws on a string without an svg element', () => {
    expect(() => svgAsset('<div></div>', { size: 16 })).toThrow('no <svg> element');
  });
});
