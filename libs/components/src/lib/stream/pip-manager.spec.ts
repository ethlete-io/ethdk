import '../../test-helpers';
import { flushFrames } from '../testing/driver-core';
import { createStreamDriver } from './testing/stream-driver';

const PLAYER_ID = 'youtube-abc';

describe('PipManager', () => {
  const setup = () => {
    const driver = createStreamDriver();
    const playerEl = driver.addPlayer(PLAYER_ID);
    const slotEl = driver.addSlot(PLAYER_ID);

    return { driver, slotEl, playerEl };
  };

  it('keeps the player in its slot after a skipped exit animation tears the pip player down', () => {
    const { driver, slotEl } = setup();

    driver.pipManager.pipActivate(slotEl);
    driver.pipManager.pipDeactivate(PLAYER_ID, { skipAnimation: true });

    expect(driver.parentOf(PLAYER_ID)).toBe(slotEl);

    driver.pipManager.parkPlayerElement(PLAYER_ID);

    expect(driver.parentOf(PLAYER_ID)).toBe(slotEl);
  });

  it('keeps the player in its slot when the exit rects are unmeasurable', () => {
    const { driver, slotEl } = setup();

    driver.pipManager.pipActivate(slotEl);
    driver.pipManager.pipDeactivate(PLAYER_ID);
    driver.pipManager.parkPlayerElement(PLAYER_ID);

    expect(driver.parentOf(PLAYER_ID)).toBe(slotEl);
  });

  it('leaves the player with the exit animation while it is in flight', () => {
    const { driver, slotEl, playerEl } = setup();

    driver.pipManager.pipActivate(slotEl);
    driver.measure(playerEl, 320, 180);
    driver.measure(slotEl, 640, 360);

    driver.pipManager.pipDeactivate(PLAYER_ID);
    driver.pipManager.parkPlayerElement(PLAYER_ID);

    expect(driver.isParked(PLAYER_ID)).toBe(false);
    expect(driver.parentOf(PLAYER_ID)).not.toBe(slotEl);
  });

  it('parks the player while it is still in pip', () => {
    const { driver, slotEl } = setup();

    driver.pipManager.pipActivate(slotEl);
    driver.attachToPipHost(PLAYER_ID);

    driver.pipManager.parkPlayerElement(PLAYER_ID);

    expect(driver.isParked(PLAYER_ID)).toBe(true);
  });

  it('hands the player back to its slot and drops the wrapper when the flip exit animation finishes', async () => {
    const { driver, slotEl, playerEl } = setup();

    driver.pipManager.pipActivate(slotEl);
    driver.measure(playerEl, 320, 180);
    driver.measure(slotEl, 640, 360);

    driver.pipManager.pipDeactivate(PLAYER_ID);

    const wrapper = driver.parentOf(PLAYER_ID);

    expect(wrapper).not.toBe(slotEl);

    await driver.advance();

    expect(driver.parentOf(PLAYER_ID)).toBe(slotEl);
    expect(wrapper?.isConnected).toBe(false);
  });

  it('reassigns the player only once the scale-fade exit animation clears the animating-out latch', async () => {
    const { driver, slotEl } = setup();

    driver.pipManager.pipActivate(slotEl);
    driver.pipManager.setFeaturedPip('youtube-featured');
    driver.pipManager.pipDeactivate(PLAYER_ID);

    driver.addSlot(PLAYER_ID, { priority: true });

    expect(driver.parentOf(PLAYER_ID)).toBe(slotEl);

    await driver.advance();

    const settledSlotEl = driver.addSlot(PLAYER_ID, { priority: true });

    expect(driver.parentOf(PLAYER_ID)).toBe(settledSlotEl);
  });
});

describe('exit animation settling', () => {
  it('runs the finish handler for an animation that plays out', async () => {
    const anim = document.createElement('div').animate([], { duration: 200 });
    const calls: string[] = [];

    anim.onfinish = () => calls.push('finish');
    anim.oncancel = () => calls.push('cancel');

    await flushFrames();

    expect(calls).toEqual(['finish']);
    expect(anim.playState).toBe('finished');
  });

  it('suppresses the queued finish of an animation that was cancelled first', async () => {
    const anim = document.createElement('div').animate([], { duration: 200 });
    const calls: string[] = [];

    anim.onfinish = () => calls.push('finish');
    anim.oncancel = () => calls.push('cancel');

    anim.cancel();

    await flushFrames();

    expect(calls).toEqual(['cancel']);
    expect(anim.playState).toBe('idle');
  });
});
