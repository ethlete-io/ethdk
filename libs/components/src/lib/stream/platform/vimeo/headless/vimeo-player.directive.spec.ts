import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import '../../../../../test-helpers';
import { STREAM_ERROR_CODES } from '../../../stream-errors';
import { injectStreamScriptLoader } from '../../../stream-script-loader';
import { VimeoPlayerParamsDirective } from './vimeo-player-params.directive';
import { VimeoPlayerDirective } from './vimeo-player.directive';
import { VimeoPlayerOptions, VimeoWindow } from './vimeo-player.types';

@Component({
  selector: 'et-test-vimeo-host',
  template: '',
  hostDirectives: [
    { directive: VimeoPlayerParamsDirective, inputs: ['videoId', 'startTime', 'width', 'height'] },
    VimeoPlayerDirective,
  ],
})
class HostComponent {}

const win = window as unknown as Partial<VimeoWindow>;

type Handler = (data: unknown) => void;

class FakeVimeoPlayer {
  static instances: FakeVimeoPlayer[] = [];
  static readyResult: Promise<void> | null = null;
  static initialMuted = false;
  static initialDuration = 200;

  handlers = new Map<string, Set<Handler>>();
  muted = FakeVimeoPlayer.initialMuted;
  duration = FakeVimeoPlayer.initialDuration;
  destroyed = false;
  calls: string[] = [];

  constructor(
    public element: HTMLElement,
    public options: VimeoPlayerOptions,
  ) {
    FakeVimeoPlayer.instances.push(this);
  }

  ready() {
    return FakeVimeoPlayer.readyResult ?? Promise.resolve();
  }
  getMuted() {
    return Promise.resolve(this.muted);
  }
  getDuration() {
    return Promise.resolve(this.duration);
  }
  on(event: string, handler: Handler) {
    this.handlers.set(event, (this.handlers.get(event) ?? new Set()).add(handler));
  }
  off(event: string, handler?: Handler) {
    if (handler) this.handlers.get(event)?.delete(handler);
  }
  emit(event: string, data?: unknown) {
    this.handlers.get(event)?.forEach((handler) => handler(data));
  }
  play() {
    this.calls.push('play');
    return Promise.resolve();
  }
  pause() {
    this.calls.push('pause');
    return Promise.resolve();
  }
  setMuted(muted: boolean) {
    this.calls.push(`setMuted:${muted}`);
    return Promise.resolve(muted);
  }
  setCurrentTime(seconds: number) {
    this.calls.push(`setCurrentTime:${seconds}`);
    return Promise.resolve(seconds);
  }
  destroy() {
    this.destroyed = true;
    return Promise.resolve();
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = async (inputs: Record<string, unknown> = { videoId: 123 }) => {
  const load = vi
    .spyOn(
      TestBed.runInInjectionContext(() => injectStreamScriptLoader()),
      'load',
    )
    .mockReturnValue(of(undefined));
  const fixture = TestBed.createComponent(HostComponent);

  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }

  const settle = async () => {
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
  };

  await settle();

  return {
    fixture,
    load,
    settle,
    host: fixture.nativeElement as HTMLElement,
    player: fixture.debugElement.injector.get(VimeoPlayerDirective),
    instance: () => FakeVimeoPlayer.instances.at(-1) as FakeVimeoPlayer,
  };
};

describe('VimeoPlayerDirective', () => {
  beforeEach(() => {
    FakeVimeoPlayer.instances = [];
    FakeVimeoPlayer.readyResult = null;
    FakeVimeoPlayer.initialMuted = false;
    FakeVimeoPlayer.initialDuration = 200;
    win.Vimeo = { Player: FakeVimeoPlayer } as unknown as VimeoWindow['Vimeo'];
  });

  afterEach(() => {
    delete win.Vimeo;
  });

  it('should load the player SDK and create a responsive player for the video', async () => {
    const { load, instance, host } = await setup({ videoId: 123 });

    expect(load).toHaveBeenCalledWith('https://player.vimeo.com/api/player.js');
    expect(instance().options).toEqual({ id: 123, responsive: true });
    expect(instance().element).toBe(host);
  });

  it('should size the host element from numeric and string dimensions', async () => {
    const { host } = await setup({ videoId: 1, width: '640', height: '50%' });

    expect(host.style.display).toBe('block');
    expect(host.style.width).toBe('640px');
    expect(host.style.height).toBe('50%');
  });

  it('should report VIMEO_SDK_NOT_AVAILABLE when the SDK has no Player after load', async () => {
    delete win.Vimeo;
    const { player } = await setup();

    const error = player.state().error as Error;

    expect(error.message).toContain(`ET${STREAM_ERROR_CODES.VIMEO_SDK_NOT_AVAILABLE}`);
    expect(player.state().isLoading).toBe(false);
    expect(player.state().isReady).toBe(false);
  });

  it('should be loading until the player is ready', async () => {
    FakeVimeoPlayer.readyResult = new Promise(() => undefined);
    const { player } = await setup();

    expect(player.state()).toMatchObject({ isReady: false, isLoading: true });
  });

  it('should become ready with the muted flag and duration', async () => {
    FakeVimeoPlayer.initialMuted = true;
    const { player } = await setup();

    expect(player.state()).toMatchObject({
      isReady: true,
      isLoading: false,
      isMuted: true,
      duration: 200,
      error: null,
    });
  });

  it('should treat a non-finite duration as unknown', async () => {
    FakeVimeoPlayer.initialDuration = Infinity;
    const { player } = await setup();

    expect(player.state()).toMatchObject({ isReady: true, duration: null });
  });

  it('should seek to the start time once ready', async () => {
    const { instance } = await setup({ videoId: 1, startTime: 45 });

    expect(instance().calls).toEqual(['setCurrentTime:45']);
  });

  it('should not seek when there is no start time', async () => {
    const { instance } = await setup();

    expect(instance().calls).toEqual([]);
  });

  it('should report VIMEO_SDK_NOT_AVAILABLE with the cause when the player fails to become ready', async () => {
    FakeVimeoPlayer.readyResult = Promise.reject(new Error('private video'));
    const { player } = await setup();

    const error = player.state().error as Error;

    expect(error.message).toContain(`ET${STREAM_ERROR_CODES.VIMEO_SDK_NOT_AVAILABLE}`);
    expect(error.message).toContain('private video');
    expect(player.state().isLoading).toBe(false);
  });

  it('should stringify a non-Error failure', async () => {
    FakeVimeoPlayer.readyResult = Promise.reject('nope');
    const { player } = await setup();

    expect((player.state().error as Error).message).toContain('nope');
  });

  it('should track play, pause and end', async () => {
    const { player, instance } = await setup();

    instance().emit('play', { duration: 200, seconds: 5, percent: 0 });

    expect(player.state()).toMatchObject({ isPlaying: true, isEnded: false, duration: 200, currentTime: 5 });

    instance().emit('pause', { seconds: 9 });

    expect(player.state()).toMatchObject({ isPlaying: false, currentTime: 9 });

    instance().emit('ended', { seconds: 200 });

    expect(player.state()).toMatchObject({ isPlaying: false, isEnded: true, currentTime: 200 });
  });

  it('should clear the ended flag when playing again', async () => {
    const { player, instance } = await setup();

    instance().emit('ended', { seconds: 200 });
    instance().emit('play', { duration: 200, seconds: 0 });

    expect(player.state().isEnded).toBe(false);
  });

  it('should track time and duration updates', async () => {
    const { player, instance } = await setup();

    instance().emit('timeupdate', { duration: 210, seconds: 33 });

    expect(player.state()).toMatchObject({ duration: 210, currentTime: 33 });

    instance().emit('durationchange', { duration: 300 });

    expect(player.state()).toMatchObject({ duration: 300, currentTime: 33 });
  });

  it('should re-read the muted flag on volume change', async () => {
    const { player, instance } = await setup();
    instance().muted = true;

    instance().emit('volumechange');
    await flush();

    expect(player.state().isMuted).toBe(true);
  });

  it('should forward the controls to the player', async () => {
    const { player, instance } = await setup();

    player.play();
    player.pause();
    player.mute();
    player.unmute();
    player.seek(12);

    expect(instance().calls).toEqual(['play', 'pause', 'setMuted:true', 'setMuted:false', 'setCurrentTime:12']);
  });

  it('should detach listeners, destroy the player and reset the state when destroyed', async () => {
    const { player, instance, fixture } = await setup();
    const fake = instance();

    fixture.destroy();

    expect(fake.destroyed).toBe(true);
    expect([...fake.handlers.values()].every((set) => set.size === 0)).toBe(true);
    expect(player.state()).toMatchObject({ isReady: false, isLoading: true });
  });

  it('should ignore a late ready result after destroy', async () => {
    let resolveReady = () => undefined as void;
    FakeVimeoPlayer.readyResult = new Promise<void>((resolve) => (resolveReady = resolve));
    const { player, fixture } = await setup();

    fixture.destroy();
    resolveReady();
    await flush();

    expect(player.state().isReady).toBe(false);
  });

  it('should create a new player when the video id changes', async () => {
    const { fixture, settle, instance } = await setup();
    const first = instance();

    fixture.componentRef.setInput('videoId', 456);
    await settle();

    expect(first.destroyed).toBe(true);
    expect(instance().options.id).toBe(456);
  });

  it('should rebuild the player and clear the error on retry after a failure', async () => {
    FakeVimeoPlayer.readyResult = Promise.reject(new Error('boom'));
    const { player, settle } = await setup();

    FakeVimeoPlayer.readyResult = null;
    player.retry();
    await settle();

    expect(FakeVimeoPlayer.instances).toHaveLength(2);
    expect(player.state()).toMatchObject({ isReady: true, error: null });
  });
});
