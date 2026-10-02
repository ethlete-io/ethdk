import { ApplicationRef, ErrorHandler } from '@angular/core';
import { ReactiveNode, SIGNAL } from '@angular/core/primitives/signals';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { provideStreamPip } from './stream-pip.provider';
import { FakeStreamConsentComponent, createStreamSlotDriver } from './testing/stream-driver';

const fakePlayers = () => document.querySelectorAll('et-fake-stream-player').length;

describe('createStreamPlayerSlot', () => {
  it('keeps picture-in-picture inactive without its provider, and says so', async () => {
    const driver = createStreamSlotDriver({ consentGranted: true });
    await driver.settle();
    const handleError = vi.spyOn(TestBed.inject(ErrorHandler), 'handleError').mockImplementation(() => undefined);

    expect(driver.slot().pipActivate()).toBe(false);
    expect(driver.slot().pipDeactivate()).toBe(false);
    await driver.settle();

    expect(document.querySelector('et-stream-pip-chrome')).toBeNull();
    expect(String(handleError.mock.calls[0]?.[0])).toContain('ET1612');
  });

  it('reports whether picture-in-picture was entered and left', async () => {
    const driver = createStreamSlotDriver({ consentGranted: true, providers: [provideStreamPip()] });
    await driver.settle();

    expect(driver.slot().pipActivate()).toBe(true);
    expect(driver.slot().pipActivate()).toBe(false);
    expect(driver.slot().pipDeactivate()).toBe(true);
    expect(driver.slot().pipDeactivate()).toBe(false);
  });

  it('refuses picture-in-picture while the consent gate is still up', async () => {
    const driver = createStreamSlotDriver({ providers: [provideStreamPip()] });
    await driver.settle();

    expect(driver.slot().pipActivate()).toBe(false);
  });

  it('registers the live player id when consent arrives after an id change', async () => {
    const driver = createStreamSlotDriver();
    await driver.settle();

    driver.setPlayerId('youtube-new');
    await driver.settle();

    driver.grant();
    await driver.settle();

    expect(driver.slot().currentPlayerId()).toBe('youtube-new');
    expect(driver.playerElementFor('youtube-new')).not.toBeNull();
    expect(driver.playerElementFor('youtube-old')).toBeNull();
  });

  it('registers the live player id when the consent component is accepted after an id change', async () => {
    const driver = createStreamSlotDriver({ consentComponent: FakeStreamConsentComponent });
    await driver.settle();

    driver.setPlayerId('youtube-new');
    await driver.settle();

    expect(driver.consentHost()).not.toBeNull();

    driver.grant();
    await driver.settle();

    expect(driver.playerElementFor('youtube-new')).not.toBeNull();
    expect(driver.playerElementFor('youtube-old')).toBeNull();
  });

  it('registers the current player id when consent is already granted', async () => {
    const driver = createStreamSlotDriver({ consentGranted: true });
    await driver.settle();

    expect(driver.playerElementFor('youtube-old')).not.toBeNull();
  });

  it('moves the player to a slot whose priority turns on after mount', async () => {
    const driver = createStreamSlotDriver({ consentGranted: true, slotCount: 2 });
    await driver.settle();

    expect(driver.slotElement(1)?.contains(driver.playerElementFor('youtube-old'))).toBe(true);

    driver.setPriority(true, 0);
    await driver.settle();

    expect(driver.slotElement(0)?.contains(driver.playerElementFor('youtube-old'))).toBe(true);
  });

  it('keeps the shared player with the other slot when a slot that adopted it changes its id', async () => {
    const driver = createStreamSlotDriver({ consentGranted: true, slotCount: 2 });
    await driver.settle();

    driver.setPlayerId('youtube-new', 1);
    await driver.settle();

    expect(driver.slotElement(0)?.contains(driver.playerElementFor('youtube-old'))).toBe(true);
    expect(driver.slotElement(1)?.contains(driver.playerElementFor('youtube-new'))).toBe(true);
    expect(fakePlayers()).toBe(2);
  });

  it('gives the other slot a player of its own when the slot that created the shared player changes its id', async () => {
    const driver = createStreamSlotDriver({ consentGranted: true, slotCount: 2 });
    await driver.settle();

    driver.setPlayerId('youtube-new', 0);
    await driver.settle();

    expect(driver.slotElement(0)?.contains(driver.playerElementFor('youtube-new'))).toBe(true);
    expect(driver.slotElement(1)?.contains(driver.playerElementFor('youtube-old'))).toBe(true);
    expect(fakePlayers()).toBe(2);
  });

  it('adopts the existing player and destroys its own when it changes to an id that already has one', async () => {
    const driver = createStreamSlotDriver({ consentGranted: true, slotCount: 2 });
    driver.setPlayerId('youtube-new', 1);
    await driver.settle();

    expect(fakePlayers()).toBe(2);

    driver.setPlayerId('youtube-new', 0);
    await driver.settle();

    expect(driver.playerElementFor('youtube-old')).toBeNull();
    expect(fakePlayers()).toBe(1);
  });

  it('shows the loading and error overlays in the slot that holds the player', async () => {
    const driver = createStreamSlotDriver({ consentGranted: true, slotCount: 2 });
    await driver.settle();

    expect(driver.slotElement(1)?.querySelector('et-fake-stream-chrome')).not.toBeNull();
    expect(driver.slotElement(0)?.querySelector('et-fake-stream-chrome')).toBeNull();

    driver.removeSlot(1);
    await driver.settle();

    expect(driver.slotElement(0)?.querySelector('et-fake-stream-chrome')).not.toBeNull();

    driver.playerFor('youtube-old')?.setState({ error: new Error('blocked') });
    await driver.settle();

    expect(driver.slotElement(0)?.querySelector('et-fake-stream-error')).not.toBeNull();
    expect(driver.slotElement(0)?.querySelector('et-fake-stream-chrome')).toBeNull();
  });

  it('shows the error overlay after the slot that created the player is destroyed', async () => {
    const driver = createStreamSlotDriver({ consentGranted: true, slotCount: 2 });
    await driver.settle();

    driver.removeSlot(0);
    await driver.settle();

    driver.playerFor('youtube-old')?.setState({ error: new Error('blocked') });
    await driver.settle();

    expect(driver.slotElement(1)?.querySelector('et-fake-stream-error')).not.toBeNull();
  });

  it('destroys the player and shows the consent gate again when consent is revoked', async () => {
    const driver = createStreamSlotDriver({ consentGranted: true, consentComponent: FakeStreamConsentComponent });
    await driver.settle();

    expect(fakePlayers()).toBe(1);

    driver.revoke();
    await driver.settle();

    expect(driver.playerElementFor('youtube-old')).toBeNull();
    expect(fakePlayers()).toBe(0);
    expect(driver.consentHost()).not.toBeNull();

    driver.grant();
    await driver.settle();

    expect(fakePlayers()).toBe(1);
    expect(driver.consentHost()).toBeNull();
  });

  it('destroys the player when consent is revoked without a consent component', async () => {
    const driver = createStreamSlotDriver({ consentGranted: true });
    await driver.settle();

    driver.revoke();
    await driver.settle();

    expect(fakePlayers()).toBe(0);
  });

  it('stops watching consent once a pending slot is destroyed', async () => {
    const driver = createStreamSlotDriver();
    await driver.settle();
    await driver.settle();

    driver.fixture.destroy();
    TestBed.inject(ApplicationRef).tick();

    expect((driver.consentHandler.isGranted[SIGNAL] as ReactiveNode).consumers).toBeUndefined();
  });
});
