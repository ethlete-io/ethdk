import '../../test-helpers';
import { FakeStreamConsentComponent, createStreamSlotDriver } from './testing/stream-driver';

describe('createStreamPlayerSlot', () => {
  it('registers the live player id when consent arrives after an id change', async () => {
    const driver = createStreamSlotDriver();
    await driver.settle();

    driver.setPlayerId('youtube-new');
    await driver.settle();

    driver.grant();
    await driver.settle();

    expect(driver.slot().currentPlayerIdSignal()).toBe('youtube-new');
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
});
