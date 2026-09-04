import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { KBD_PLATFORM } from '../kbd';
import { pressKey } from '../testing/driver-core';
import { createOverlayDriver } from '../testing/overlay-driver';
import { CommandPaletteShortcutDirective } from './command-palette-shortcut.directive';
import { injectCommandPalette } from './command-palette.overlay';

@Component({
  template: `<div etCommandPaletteShortcut></div>`,
  imports: [CommandPaletteShortcutDirective],
})
class ShortcutHostComponent {}

describe('CommandPaletteShortcutDirective', () => {
  let driver: ReturnType<typeof createOverlayDriver>;

  const openPalettes = () => document.querySelectorAll('et-command-palette').length;

  const pressChord = () => pressKey(document, 'k', { code: 'KeyK', ctrlKey: true });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: KBD_PLATFORM, useValue: 'other' }] });

    const fixture = TestBed.createComponent(ShortcutHostComponent);
    fixture.detectChanges();

    driver = createOverlayDriver(fixture);
  });

  afterEach(() => {
    driver.closeAll();
  });

  it('opens the palette on the chord and closes it again on the same chord', async () => {
    await driver.openVia(() => pressChord());

    expect(openPalettes()).toBe(1);

    pressChord();
    await driver.settle();
    await driver.settle();

    expect(openPalettes()).toBe(0);
  });

  it('closes a palette that was opened programmatically', async () => {
    await driver.openVia(() => TestBed.runInInjectionContext(() => injectCommandPalette().open()));

    expect(openPalettes()).toBe(1);

    pressChord();
    await driver.settle();
    await driver.settle();

    expect(openPalettes()).toBe(0);
  });
});
