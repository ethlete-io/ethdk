import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { injectPipManager } from './pip-manager';
import { injectStreamManager } from './stream-manager';

const PLAYER_ID = 'youtube-abc';

const rect = (width: number, height: number) =>
  ({ x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}) }) as DOMRect;

describe('PipManager', () => {
  const setup = () => {
    const { pipManager, streamManager } = TestBed.runInInjectionContext(() => ({
      pipManager: injectPipManager(),
      streamManager: injectStreamManager(),
    }));

    const slotEl = document.createElement('div');
    const playerEl = document.createElement('div');
    document.body.appendChild(slotEl);

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
});
