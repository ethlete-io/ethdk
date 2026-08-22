import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { flushFrames } from '../testing/driver-core';
import { injectPipManager } from './pip-manager';
import { injectStreamManager } from './stream-manager';

const PLAYER_ID = 'youtube-abc';

const rect = (width: number, height: number) =>
  ({ x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}) }) as DOMRect;

const appendSlotElement = () => {
  const element = document.createElement('div');
  document.body.appendChild(element);

  return element;
};

describe('PipManager', () => {
  const setup = () => {
    const { pipManager, streamManager } = TestBed.runInInjectionContext(() => ({
      pipManager: injectPipManager(),
      streamManager: injectStreamManager(),
    }));

    const slotEl = appendSlotElement();
    const playerEl = document.createElement('div');

    streamManager.registerPlayer({ id: PLAYER_ID, element: playerEl });
    streamManager.registerSlot({ playerId: PLAYER_ID, priority: false, element: slotEl });

    return { pipManager, streamManager, slotEl, playerEl };
  };

  const containerOf = (el: HTMLElement) => el.parentElement?.classList.contains('et-stream-manager') ?? false;

  it('keeps the player in its slot after a skipped exit animation tears the pip player down', () => {
    const { pipManager, slotEl, playerEl } = setup();

    pipManager.pipActivate(slotEl);
    pipManager.pipDeactivate(PLAYER_ID, { skipAnimation: true });

    expect(playerEl.parentElement).toBe(slotEl);

    pipManager.parkPlayerElement(PLAYER_ID);

    expect(playerEl.parentElement).toBe(slotEl);
  });

  it('keeps the player in its slot when the exit rects are unmeasurable', () => {
    const { pipManager, slotEl, playerEl } = setup();

    pipManager.pipActivate(slotEl);
    pipManager.pipDeactivate(PLAYER_ID);
    pipManager.parkPlayerElement(PLAYER_ID);

    expect(playerEl.parentElement).toBe(slotEl);
  });

  it('leaves the player with the exit animation while it is in flight', () => {
    const { pipManager, slotEl, playerEl } = setup();

    pipManager.pipActivate(slotEl);
    playerEl.getBoundingClientRect = () => rect(320, 180);
    slotEl.getBoundingClientRect = () => rect(640, 360);

    pipManager.pipDeactivate(PLAYER_ID);
    pipManager.parkPlayerElement(PLAYER_ID);

    expect(containerOf(playerEl)).toBe(false);
  });

  it('parks the player while it is still in pip', () => {
    const { pipManager, slotEl, playerEl } = setup();

    pipManager.pipActivate(slotEl);

    const pipHost = document.createElement('div');
    document.body.appendChild(pipHost);
    pipHost.appendChild(playerEl);

    pipManager.parkPlayerElement(PLAYER_ID);

    expect(containerOf(playerEl)).toBe(true);
  });

  it('hands the player back to its slot and drops the wrapper when the flip exit animation finishes', async () => {
    const { pipManager, slotEl, playerEl } = setup();

    pipManager.pipActivate(slotEl);
    playerEl.getBoundingClientRect = () => rect(320, 180);
    slotEl.getBoundingClientRect = () => rect(640, 360);

    pipManager.pipDeactivate(PLAYER_ID);

    const wrapper = playerEl.parentElement;

    expect(wrapper).not.toBe(slotEl);

    await flushFrames();

    expect(playerEl.parentElement).toBe(slotEl);
    expect(wrapper?.isConnected).toBe(false);
  });

  it('reassigns the player only once the scale-fade exit animation clears the animating-out latch', async () => {
    const { pipManager, streamManager, slotEl, playerEl } = setup();

    pipManager.pipActivate(slotEl);
    pipManager.setFeaturedPip('youtube-featured');
    pipManager.pipDeactivate(PLAYER_ID);

    streamManager.registerSlot({ playerId: PLAYER_ID, priority: true, element: appendSlotElement() });

    expect(playerEl.parentElement).toBe(slotEl);

    await flushFrames();

    const settledSlotEl = appendSlotElement();
    streamManager.registerSlot({ playerId: PLAYER_ID, priority: true, element: settledSlotEl });

    expect(playerEl.parentElement).toBe(settledSlotEl);
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
