import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import {
  AnchoredPanelOverlayRef,
  AnchoredPanelSurfaceLike,
  createAnchoredPanelController,
} from './anchored-panel-controller';

@Component({ template: '' })
class MissingSurfaceHost {
  open = signal(false);
  missingSurfaceCalls = 0;

  constructor() {
    createAnchoredPanelController({
      canOpen: signal(true),
      open: this.open,
      overlayRef: signal<AnchoredPanelOverlayRef | null>(null),
      surface: signal<AnchoredPanelSurfaceLike | null>(null),
      anchor: () => null,
      config: () => ({}),
      onMissingSurface: () => this.missingSurfaceCalls++,
    });
  }
}

describe('createAnchoredPanelController', () => {
  it('closes the open model again when no surface is registered', () => {
    const fixture = TestBed.createComponent(MissingSurfaceHost);
    const host = fixture.componentInstance;

    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    expect(host.missingSurfaceCalls).toBe(1);
    expect(host.open()).toBe(false);
  });
});
