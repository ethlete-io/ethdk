import { TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { provideStreamLabels } from '../../stream-labels';
import { createStreamDriver } from '../../testing/stream-driver';
import { PipWindowComponent } from '../pip-window.component';
import { animateScaleFadeOut } from './internals/pip-animation';
import { createPipChromeState } from './pip-chrome-state';

const setup = () => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideStreamLabels({ pipGridView: 'Rasteransicht', pipSingleView: 'Einzelansicht' })],
  });

  const driver = createStreamDriver();
  const state = TestBed.runInInjectionContext(() => createPipChromeState());
  const exits: ((resetWindow: () => void) => void)[] = [];
  const pipWindow = {
    posState: { animateExit: (callback: (resetWindow: () => void) => void) => exits.push(callback) },
  } as unknown as PipWindowComponent;

  const activate = (playerId: string) => {
    driver.addPlayer(playerId);
    driver.pipManager.pipActivate(driver.addSlot(playerId));
  };

  return { driver, state, pipWindow, exits, activate };
};

describe('createPipChromeState', () => {
  it('reads the grid toggle label from the stream labels', () => {
    const { state } = setup();

    expect(state.gridToggleLabel()).toBe('Rasteransicht');

    state.multiView.set(true);

    expect(state.gridToggleLabel()).toBe('Einzelansicht');
  });

  it('starts one exit animation when close is pressed twice', () => {
    const { state, pipWindow, exits, activate } = setup();

    activate('youtube-a');
    state.close(new Event('click'), pipWindow);
    state.close(new Event('click'), pipWindow);

    expect(exits.length).toBe(1);
  });

  it('shows the window again when a pip enters during the exit animation', () => {
    const { state, pipWindow, exits, activate, driver } = setup();
    const resetWindow = vi.fn();

    activate('youtube-a');
    state.close(new Event('click'), pipWindow);
    activate('youtube-b');
    exits[0]!(resetWindow);

    expect(driver.pipManager.pips().map((pip) => pip.playerId)).toEqual(['youtube-b']);
    expect(resetWindow).toHaveBeenCalledTimes(1);
  });

  it('keeps the window hidden when the exit animation closes every pip', () => {
    const { state, pipWindow, exits, activate } = setup();
    const resetWindow = vi.fn();

    activate('youtube-a');
    state.close(new Event('click'), pipWindow);
    exits[0]!(resetWindow);

    expect(resetWindow).not.toHaveBeenCalled();
  });
});

describe('animateScaleFadeOut', () => {
  it('drops the forwards fill when the finish handler resets it', () => {
    const el = document.createElement('div');
    const animation = { onfinish: null as (() => void) | null, cancel: vi.fn() };

    vi.spyOn(el, 'animate').mockReturnValue(animation as unknown as Animation);
    animateScaleFadeOut(el, { onFinish: (reset) => reset() });
    animation.onfinish?.();

    expect(animation.cancel).toHaveBeenCalledTimes(1);
  });
});
