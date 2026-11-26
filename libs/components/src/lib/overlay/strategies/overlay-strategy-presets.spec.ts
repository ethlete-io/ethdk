import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { FakeMatchMedia, fakeMatchMedia } from '../../testing/fake-match-media';
import { createOverlayDriver } from '../../testing/overlay-driver';
import { OverlayStrategyBreakpoint } from './overlay-strategy.types';
import {
  transformingBottomSheetToDialogOverlayStrategy,
  transformingFullScreenDialogToRightSheetOverlayStrategy,
} from './presets';

const PHONE_WIDTH = 500;
const DESKTOP_WIDTH = 1024;

@Component({ template: 'preset content' })
class PresetContentComponent {}

describe('transforming overlay strategy presets', () => {
  let breakpoints: FakeMatchMedia;
  let driver: ReturnType<typeof createOverlayDriver> | null = null;

  beforeEach(() => {
    breakpoints = fakeMatchMedia();
    breakpoints.setViewportWidth(PHONE_WIDTH);

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    driver?.closeAll();
    driver = null;
  });

  const openWith = async (strategies: () => OverlayStrategyBreakpoint[]) => {
    driver = createOverlayDriver(null, { breakpoints, config: { strategies } });

    await driver.open(PresetContentComponent);

    return driver;
  };

  const paneHas = (overlayDriver: ReturnType<typeof createOverlayDriver>, containerClass: string) =>
    overlayDriver.pane()?.classList.contains(containerClass) ?? null;

  it('opens as a bottom sheet below the breakpoint and turns into a dialog above it', async () => {
    const overlayDriver = await openWith(transformingBottomSheetToDialogOverlayStrategy());

    expect(paneHas(overlayDriver, 'et-overlay--bottom-sheet')).toBe(true);
    expect(overlayDriver.backdrop()).not.toBeNull();

    overlayDriver.switchBreakpoint(DESKTOP_WIDTH);

    expect(paneHas(overlayDriver, 'et-overlay--dialog')).toBe(true);
    expect(paneHas(overlayDriver, 'et-overlay--bottom-sheet')).toBe(false);
    expect(overlayDriver.backdrop()).not.toBeNull();

    overlayDriver.switchBreakpoint(PHONE_WIDTH);

    expect(paneHas(overlayDriver, 'et-overlay--bottom-sheet')).toBe(true);
    expect(paneHas(overlayDriver, 'et-overlay--dialog')).toBe(false);
  });

  it('opens as a full-screen dialog below the breakpoint and turns into a right sheet above it', async () => {
    const overlayDriver = await openWith(transformingFullScreenDialogToRightSheetOverlayStrategy());

    expect(paneHas(overlayDriver, 'et-overlay--full-screen-dialog')).toBe(true);

    overlayDriver.switchBreakpoint(DESKTOP_WIDTH);

    expect(paneHas(overlayDriver, 'et-overlay--right-sheet')).toBe(true);
    expect(paneHas(overlayDriver, 'et-overlay--full-screen-dialog')).toBe(false);
  });

  it('switches at a custom numeric breakpoint instead of the default one', async () => {
    const overlayDriver = await openWith(transformingBottomSheetToDialogOverlayStrategy({ breakpoint: 1200 }));

    overlayDriver.switchBreakpoint(DESKTOP_WIDTH);

    expect(paneHas(overlayDriver, 'et-overlay--bottom-sheet')).toBe(true);

    overlayDriver.switchBreakpoint(1280);

    expect(paneHas(overlayDriver, 'et-overlay--dialog')).toBe(true);
  });

  it('closes on Escape while the switched-to strategy is active', async () => {
    const overlayDriver = await openWith(transformingBottomSheetToDialogOverlayStrategy());

    overlayDriver.switchBreakpoint(DESKTOP_WIDTH);
    await overlayDriver.escape();

    expect(overlayDriver.openOverlays()).toHaveLength(0);
  });
});
