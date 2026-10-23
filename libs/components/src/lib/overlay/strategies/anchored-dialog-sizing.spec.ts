import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { fakeMatchMedia } from '../../testing/fake-match-media';
import { createOverlayDriver } from '../../testing/overlay-driver';
import { anchoredDialogOverlayStrategy } from './anchored-dialog.strategy';

@Component({ template: 'popover content' })
class SizingContentComponent {}

describe('anchored dialog sizing', () => {
  let driver: ReturnType<typeof createOverlayDriver>;
  let origin: HTMLButtonElement;

  beforeEach(() => {
    fakeMatchMedia();
    TestBed.configureTestingModule({});
    driver = createOverlayDriver();
    origin = document.createElement('button');
    document.body.appendChild(origin);
  });

  afterEach(() => {
    driver.closeAll();
    origin.remove();
  });

  it('keeps the configured width once the pane is positioned', async () => {
    await driver.open(SizingContentComponent, {
      origin,
      strategies: anchoredDialogOverlayStrategy({ width: '42rem' }),
    });

    expect(driver.pane()?.style.width).toBe('42rem');
  });
});
