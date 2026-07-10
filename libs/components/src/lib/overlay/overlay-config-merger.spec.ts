import { StaticProvider, inputBinding } from '@angular/core';
import '../../test-helpers';
import { mergeOverlayConfigs } from './overlay-config-merger';

describe('mergeOverlayConfigs', () => {
  it('returns an empty config for no layers', () => {
    expect(mergeOverlayConfigs()).toEqual({});
    expect(mergeOverlayConfigs(undefined, undefined)).toEqual({});
  });

  it('concatenates bindings in layer order', () => {
    const first = inputBinding('a', () => 1);
    const second = inputBinding('b', () => 2);
    const third = inputBinding('c', () => 3);

    const merged = mergeOverlayConfigs({ bindings: [first] }, { bindings: [second, third] });

    expect(merged.bindings).toEqual([first, second, third]);
  });

  it('concatenates providers in layer order', () => {
    const tokenA = { provide: 'a', useValue: 1 } satisfies StaticProvider;
    const tokenB = { provide: 'b', useValue: 2 } satisfies StaticProvider;

    const merged = mergeOverlayConfigs({ providers: [tokenA] }, undefined, { providers: [tokenB] });

    expect(merged.providers).toEqual([tokenA, tokenB]);
  });

  it('normalizes, concatenates and dedupes class lists', () => {
    const merged = mergeOverlayConfigs(
      { panelClass: 'base', hostClass: ['host-a', 'host-b'] },
      { panelClass: ['opener', 'base'], backdropClass: 'backdrop' },
    );

    expect(merged.panelClass).toEqual(['base', 'opener']);
    expect(merged.hostClass).toEqual(['host-a', 'host-b']);
    expect(merged.backdropClass).toEqual(['backdrop']);
  });

  it('lets the most specific layer win for scalar values', () => {
    const merged = mergeOverlayConfigs({ hasBackdrop: true, role: 'dialog' }, { hasBackdrop: false });

    expect(merged.hasBackdrop).toBe(false);
    expect(merged.role).toBe('dialog');
  });

  it('does not let undefined values clobber earlier layers', () => {
    const merged = mergeOverlayConfigs({ hasBackdrop: true }, { hasBackdrop: undefined });

    expect(merged.hasBackdrop).toBe(true);
  });

  it('lets an explicit null override earlier layers', () => {
    const merged = mergeOverlayConfigs({ ariaLabel: 'first' }, { ariaLabel: null });

    expect(merged.ariaLabel).toBeNull();
  });

  it('omits additive keys entirely when no layer sets them', () => {
    const merged = mergeOverlayConfigs({ hasBackdrop: true });

    expect(merged).toEqual({ hasBackdrop: true });
  });
});
