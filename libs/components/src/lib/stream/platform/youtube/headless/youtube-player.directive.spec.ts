import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import '../../../../../test-helpers';
import { STREAM_ERROR_CODES } from '../../../stream-errors';
import { injectStreamScriptLoader } from '../../../stream-script-loader';
import { YoutubePlayerParamsDirective } from './youtube-player-params.directive';
import { YoutubePlayerDirective } from './youtube-player.directive';
import { YtPlayerConfig, YtWindow } from './youtube-player.types';

@Component({
  selector: 'et-test-youtube-host',
  template: '',
  hostDirectives: [
    { directive: YoutubePlayerParamsDirective, inputs: ['videoId', 'startTime', 'width', 'height'] },
    YoutubePlayerDirective,
  ],
})
class HostComponent {}

const win = window as unknown as Partial<YtWindow>;

class FakeYtPlayer {
  static instances: FakeYtPlayer[] = [];

  muted = false;
  currentTime = 12;
  duration = 100;
  destroyed = false;
  calls: string[] = [];

  constructor(
    public element: HTMLElement,
    public config: YtPlayerConfig,
  ) {
    FakeYtPlayer.instances.push(this);
  }

  playVideo() {
    this.calls.push('playVideo');
  }
  pauseVideo() {
    this.calls.push('pauseVideo');
  }
  mute() {
    this.calls.push('mute');
  }
  unMute() {
    this.calls.push('unMute');
  }
  seekTo(seconds: number, allowSeekAhead: boolean) {
    this.calls.push(`seekTo:${seconds}:${allowSeekAhead}`);
  }
  isMuted() {
    return this.muted;
  }
  getCurrentTime() {
    return this.currentTime;
  }
  getDuration() {
    return this.duration;
  }
  destroy() {
    this.destroyed = true;
  }
}

const YT_STATES = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

const installYt = () => {
  win.YT = { Player: FakeYtPlayer, PlayerState: YT_STATES } as unknown as YtWindow['YT'];
};

const setup = async (inputs: Record<string, unknown> = { videoId: 'vid1' }) => {
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
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };

  await settle();

  return {
    fixture,
    load,
    settle,
    player: fixture.debugElement.injector.get(YoutubePlayerDirective),
    instance: () => FakeYtPlayer.instances.at(-1),
  };
};

describe('YoutubePlayerDirective', () => {
  beforeEach(() => {
    FakeYtPlayer.instances = [];
    installYt();
  });

  afterEach(() => {
    delete win.YT;
    delete win.onYouTubeIframeAPIReady;
  });

  it('should load the iframe API and build the player with its config', async () => {
    const { load, instance } = await setup({ videoId: 'vid1', startTime: 30, width: '640', height: '360' });

    expect(load).toHaveBeenCalledWith('https://www.youtube.com/iframe_api');
    expect(instance()?.config.videoId).toBe('vid1');
    expect(instance()?.config.width).toBe(640);
    expect(instance()?.config.height).toBe(360);
    expect(instance()?.config.playerVars).toMatchObject({ enablejsapi: 1, start: 30, rel: 0 });
  });

  it('should leave the start time out of the player vars when it is 0', async () => {
    const { instance } = await setup();

    expect(instance()?.config.playerVars?.start).toBeUndefined();
  });

  it('should be loading until the player reports ready', async () => {
    const { player } = await setup();

    expect(player.state()).toMatchObject({ isReady: false, isLoading: true, error: null });
  });

  it('should become ready on onReady', async () => {
    const { player, instance, settle } = await setup();

    instance()?.config.events?.onReady?.({ target: instance() as never });
    await settle();

    expect(player.state()).toMatchObject({ isReady: true, isLoading: false, error: null });
  });

  it('should expose the thumbnail for the video', async () => {
    const { player } = await setup({ videoId: 'vid1' });

    expect(player.thumbnail()).toBe('https://img.youtube.com/vi/vid1/mqdefault.jpg');
  });

  it('should reflect the playing state and player values on state change', async () => {
    const { player, instance } = await setup();
    const fake = instance() as FakeYtPlayer;
    fake.muted = true;

    fake.config.events?.onStateChange?.({ target: fake as never, data: YT_STATES.PLAYING });

    expect(player.state()).toMatchObject({
      isPlaying: true,
      isEnded: false,
      isMuted: true,
      duration: 100,
      currentTime: 12,
    });
  });

  it('should flag the end of the video on state change', async () => {
    const { player, instance } = await setup();
    const fake = instance() as FakeYtPlayer;

    fake.config.events?.onStateChange?.({ target: fake as never, data: YT_STATES.PLAYING });
    fake.config.events?.onStateChange?.({ target: fake as never, data: YT_STATES.ENDED });

    expect(player.state()).toMatchObject({ isPlaying: false, isEnded: true });
  });

  it('should poll the current time every 250ms only while playing', async () => {
    const { player, instance } = await setup();
    vi.useFakeTimers();

    try {
      const fake = instance() as FakeYtPlayer;

      fake.config.events?.onStateChange?.({ target: fake as never, data: YT_STATES.PLAYING });
      fake.currentTime = 40;
      vi.advanceTimersByTime(250);

      expect(player.state().currentTime).toBe(40);

      fake.config.events?.onStateChange?.({ target: fake as never, data: YT_STATES.PAUSED });
      fake.currentTime = 90;
      vi.advanceTimersByTime(1000);

      expect(player.state().currentTime).toBe(40);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should surface a YOUTUBE_PLAYER_ERROR and stop loading on onError', async () => {
    const { player, instance, settle } = await setup();
    const fake = instance() as FakeYtPlayer;

    fake.config.events?.onError?.({ target: fake as never, data: 150 });
    await settle();

    const error = player.state().error as Error;

    expect(error.message).toContain(`ET${STREAM_ERROR_CODES.YOUTUBE_PLAYER_ERROR}`);
    expect(error.message).toContain('150');
    expect(player.state().isLoading).toBe(false);
  });

  it('should report YOUTUBE_SDK_NOT_AVAILABLE when YT.Player is missing after load', async () => {
    delete win.YT;
    const { player, settle, fixture } = await setup();

    win.onYouTubeIframeAPIReady?.();
    win.YT = {} as YtWindow['YT'];
    await settle();

    expect((player.state().error as Error).message).toContain(`ET${STREAM_ERROR_CODES.YOUTUBE_SDK_NOT_AVAILABLE}`);
    expect(player.state().isLoading).toBe(false);
    fixture.destroy();
  });

  it('should wait for onYouTubeIframeAPIReady when the API is not there yet and chain the previous callback', async () => {
    delete win.YT;
    const previous = vi.fn();
    win.onYouTubeIframeAPIReady = previous;
    const { instance, settle } = await setup();

    expect(instance()).toBeUndefined();

    installYt();
    win.onYouTubeIframeAPIReady?.();
    await settle();

    expect(previous).toHaveBeenCalledTimes(1);
    expect(instance()).toBeDefined();
  });

  it('should forward the controls to the player', async () => {
    const { player, instance, settle } = await setup();
    const fake = instance() as FakeYtPlayer;

    fake.config.events?.onReady?.({ target: fake as never });
    await settle();

    player.play();
    player.pause();
    player.mute();
    player.unmute();
    player.seek(20);

    expect(fake.calls).toEqual(['playVideo', 'pauseVideo', 'mute', 'unMute', 'seekTo:20:true']);
  });

  it('should update the muted state when muting and unmuting', async () => {
    const { player } = await setup();

    player.mute();

    expect(player.state().isMuted).toBe(true);

    player.unmute();

    expect(player.state().isMuted).toBe(false);
  });

  it('should destroy the player and reset the state when destroyed', async () => {
    const { player, instance, fixture, settle } = await setup();
    const fake = instance() as FakeYtPlayer;

    fake.config.events?.onReady?.({ target: fake as never });
    await settle();
    fixture.destroy();

    expect(fake.destroyed).toBe(true);
    expect(player.state().isReady).toBe(false);
  });

  it('should build a new player when the video id changes', async () => {
    const { fixture, settle, instance } = await setup();
    const first = instance();

    fixture.componentRef.setInput('videoId', 'vid2');
    await settle();

    expect(first?.destroyed).toBe(true);
    expect(instance()?.config.videoId).toBe('vid2');
  });

  it('should rebuild the player and clear the error on retry after a failure', async () => {
    const { player, settle, instance } = await setup();
    const first = instance() as FakeYtPlayer;

    first.config.events?.onError?.({ target: first as never, data: 2 });
    await settle();
    player.retry();
    await settle();

    expect(first.destroyed).toBe(true);
    expect(FakeYtPlayer.instances).toHaveLength(2);
    expect(player.state().error).toBeNull();
  });
});
