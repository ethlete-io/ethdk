import { mergeOverlayBreakpointConfigs } from './overlay-strategy-config-merger';

describe('mergeOverlayBreakpointConfigs', () => {
  it('merges values left to right, skipping undefined', () => {
    const merged = mergeOverlayBreakpointConfigs(
      { maxWidth: '80vw', maxHeight: '80vh' },
      { maxWidth: 640, maxHeight: undefined },
    );

    expect(merged.maxWidth).toBe(640);
    expect(merged.maxHeight).toBe('80vh');
  });

  it('concatenates class buckets into arrays', () => {
    const merged = mergeOverlayBreakpointConfigs(
      { containerClass: 'et-overlay--dialog', bodyClass: 'a' },
      { containerClass: ['custom-class'], bodyClass: ['b', 'c'] },
    );

    expect(merged.containerClass).toEqual(['et-overlay--dialog', 'custom-class']);
    expect(merged.bodyClass).toEqual(['a', 'b', 'c']);
  });

  it('throws when two layout classes land in the same bucket', () => {
    expect(() =>
      mergeOverlayBreakpointConfigs(
        { containerClass: 'et-overlay--dialog' },
        { containerClass: 'et-overlay--bottom-sheet' },
      ),
    ).toThrow(/Multiple layout classes/);
  });

  it('overwrites non-class values instead of merging them', () => {
    const positionStrategy = () => ({ kind: 'global' }) as const;
    const merged = mergeOverlayBreakpointConfigs(
      { positionStrategy: () => ({ kind: 'center' }) as const, dragToDismiss: { direction: 'to-bottom' } },
      { positionStrategy, dragToDismiss: { direction: 'to-top' } },
    );

    expect(merged.positionStrategy).toBe(positionStrategy);
    expect(merged.dragToDismiss).toEqual({ direction: 'to-top' });
  });
});
