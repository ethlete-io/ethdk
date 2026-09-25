import { Component, CSP_NONCE, inject, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import { firstValueFrom } from 'rxjs';
import {
  createStreamConfig,
  DAILYMOTION_PLAYER_TOKEN,
  DailymotionPlayerComponent,
  DailymotionPlayerDirective,
  DailymotionPlayerParamsDirective,
  DailymotionPlayerSlotComponent,
  DEFAULT_STREAM_LABELS,
  DEFAULT_STREAM_PLAYER_STATE,
  FACEBOOK_PLAYER_TOKEN,
  FacebookPlayerComponent,
  FacebookPlayerDirective,
  FacebookPlayerParamsDirective,
  FacebookPlayerSlotComponent,
  injectStreamLabels,
  injectStreamManager,
  injectStreamPlayerErrorConfig,
  injectStreamPlayerLoadingConfig,
  injectStreamScriptLoader,
  KICK_PLAYER_TOKEN,
  KickPlayerComponent,
  KickPlayerDirective,
  KickPlayerParamsDirective,
  KickPlayerSlotComponent,
  provideStreamLabels,
  provideStreamManager,
  provideStreamPlayerErrorConfig,
  provideStreamPlayerLoadingConfig,
  SOOP_PLAYER_TOKEN,
  SoopPlayerComponent,
  SoopPlayerDirective,
  SoopPlayerParamsDirective,
  SoopPlayerSlotComponent,
  STREAM_ALL_IMPORTS,
  STREAM_DAILYMOTION_IMPORTS,
  STREAM_FACEBOOK_IMPORTS,
  STREAM_IMPORTS,
  STREAM_KICK_IMPORTS,
  STREAM_LABELS,
  STREAM_PLAYER_TOKEN,
  STREAM_SOOP_IMPORTS,
  STREAM_TIKTOK_IMPORTS,
  STREAM_TWITCH_IMPORTS,
  STREAM_VIMEO_IMPORTS,
  STREAM_YOUTUBE_IMPORTS,
  StreamPlayer,
  StreamPlayerErrorComponent,
  StreamPlayerLoadingComponent,
  StreamPlayerSlotDirective,
  TIKTOK_PLAYER_TOKEN,
  TikTokPlayerComponent,
  TikTokPlayerDirective,
  TikTokPlayerParamsDirective,
  TikTokPlayerSlotComponent,
  TWITCH_PLAYER_TOKEN,
  TwitchPlayerComponent,
  TwitchPlayerDirective,
  TwitchPlayerParamsDirective,
  TwitchPlayerSlotComponent,
  VIMEO_PLAYER_TOKEN,
  VimeoPlayerComponent,
  VimeoPlayerDirective,
  VimeoPlayerParamsDirective,
  VimeoPlayerSlotComponent,
  YOUTUBE_PLAYER_SLOT_TOKEN,
  YOUTUBE_PLAYER_TOKEN,
  YoutubePlayerComponent,
  YoutubePlayerDirective,
  YoutubePlayerParamsDirective,
  YoutubePlayerSlotComponent,
  YoutubePlayerSlotDirective,
  YtPlayerConfig,
} from '../index';
import { Scenario, useScenario } from './harness';

const YT_API_URL = 'https://www.youtube.com/iframe_api';
const TWITCH_EMBED_URL = 'https://embed.twitch.tv/embed/v1.js';
const VIMEO_SDK_URL = 'https://player.vimeo.com/api/player.js';
const FB_SDK_URL = 'https://connect.facebook.net/de_DE/sdk.js#xfbml=1&version=v3.2';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'danger', primary: swatch('200 30 30') },
];

const globals = () => document.defaultView as unknown as Record<string, unknown>;

const query = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const scriptTag = (src: string) =>
  Array.from(document.head.querySelectorAll('script')).find((script) => script.src === src) ?? null;

const fireScript = (s: Scenario, src: string, type: 'load' | 'error' = 'load') => {
  const script = scriptTag(src);

  if (!script) throw new Error(`no script ${src}`);

  script.dispatchEvent(new Event(type));
  s.tick();
};

const loadIframe = (s: Scenario, host: ParentNode) => {
  query('iframe', host).dispatchEvent(new Event('load'));
  s.tick();
};

type FakeYtPlayer = {
  config: YtPlayerConfig;
  calls: string[];
  time: number;
  muted: boolean;
  destroyed: boolean;
};

const installYoutube = () => {
  const players: FakeYtPlayer[] = [];

  class Player implements FakeYtPlayer {
    calls: string[] = [];
    time = 0;
    muted = false;
    destroyed = false;

    constructor(
      _element: HTMLElement | string,
      public config: YtPlayerConfig,
    ) {
      players.push(this);
    }

    playVideo = () => void this.calls.push('play');
    pauseVideo = () => void this.calls.push('pause');
    mute = () => void this.calls.push('mute');
    unMute = () => void this.calls.push('unmute');
    seekTo = (seconds: number) => void this.calls.push(`seek:${seconds}`);
    isMuted = () => this.muted;
    getCurrentTime = () => this.time;
    getDuration = () => 212;
    destroy = () => void (this.destroyed = true);
  }

  globals()['YT'] = {
    Player,
    PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    ready: (callback: () => void) => callback(),
  };

  return players;
};

type TwitchOptions = { channel?: string; video?: string; time?: string; layout?: string };

const installTwitch = () => {
  const embeds: { options: TwitchOptions; fire: (event: string) => void; calls: string[]; time: number }[] = [];

  class Embed {
    static READY = 'ready';
    static PLAY = 'play';
    static PAUSE = 'pause';
    static ENDED = 'ended';

    private handlers = new Map<string, () => void>();
    calls: string[] = [];
    time = 0;

    constructor(
      _element: HTMLElement,
      public options: TwitchOptions,
    ) {
      embeds.push(this);
    }

    addEventListener = (event: string, callback: () => void) => void this.handlers.set(event, callback);
    fire = (event: string) => this.handlers.get(event)?.();
    getPlayer = () => ({
      play: () => void this.calls.push('play'),
      pause: () => void this.calls.push('pause'),
      setMuted: (muted: boolean) => void this.calls.push(`muted:${muted}`),
      getMuted: () => true,
      seek: (seconds: number) => void this.calls.push(`seek:${seconds}`),
      getCurrentTime: () => this.time,
      getDuration: () => 0,
      addEventListener: () => undefined,
    });
  }

  globals()['Twitch'] = { Embed };

  return embeds;
};

const installVimeo = () => {
  const players: {
    id: unknown;
    fire: (event: string, data?: unknown) => void;
    calls: string[];
    listeners: () => number;
    destroyed: boolean;
  }[] = [];

  class Player {
    private handlers = new Map<string, (data: unknown) => void>();
    calls: string[] = [];
    destroyed = false;
    id: unknown;

    constructor(_element: HTMLElement, options: { id: unknown }) {
      this.id = options.id;
      players.push(this);
    }

    on = (event: string, callback: (data: unknown) => void) => void this.handlers.set(event, callback);
    off = (event: string) => void this.handlers.delete(event);
    fire = (event: string, data?: unknown) => this.handlers.get(event)?.(data);
    listeners = () => this.handlers.size;
    ready = () => Promise.resolve();
    getMuted = () => Promise.resolve(false);
    getDuration = () => Promise.resolve(95);
    play = () => Promise.resolve(void this.calls.push('play'));
    pause = () => Promise.resolve(void this.calls.push('pause'));
    setMuted = (muted: boolean) => Promise.resolve(!!this.calls.push(`muted:${muted}`));
    setCurrentTime = (seconds: number) => Promise.resolve(this.calls.push(`seek:${seconds}`));
    destroy = () => Promise.resolve(void (this.destroyed = true));
  }

  globals()['Vimeo'] = { Player };

  return players;
};

const installFacebook = () => {
  const handlers = new Set<(message: unknown) => void>();
  const parsed: Element[] = [];

  globals()['FB'] = {
    Event: {
      subscribe: (_event: string, handler: (message: unknown) => void) => void handlers.add(handler),
      unsubscribe: (_event: string, handler: (message: unknown) => void) => void handlers.delete(handler),
    },
    XFBML: { parse: (element: Element) => void parsed.push(element) },
  };

  return { handlers, parsed };
};

const createFacebookVideo = () => {
  const subscriptions = new Map<string, () => void>();
  const calls: string[] = [];

  return {
    subscriptions,
    calls,
    player: {
      play: () => void calls.push('play'),
      pause: () => void calls.push('pause'),
      seek: (seconds: number) => void calls.push(`seek:${seconds}`),
      mute: () => void calls.push('mute'),
      unmute: () => void calls.push('unmute'),
      isMuted: () => false,
      getCurrentPosition: () => 0,
      getDuration: () => 0,
      subscribe: (event: string, handler: () => void) => {
        subscriptions.set(event, handler);

        return { release: () => void subscriptions.delete(event) };
      },
    },
  };
};

@Component({
  selector: 'et-scenario-highlights',
  imports: [STREAM_IMPORTS, STREAM_YOUTUBE_IMPORTS],
  template: `<et-youtube-player-slot [videoId]="videoId()" [startTime]="30" width="640" height="360" />`,
})
class HighlightsComponent {
  videoId = signal('match-recap');
  slot = viewChild.required(YoutubePlayerSlotComponent);
}

@Component({
  selector: 'et-scenario-headless-youtube',
  template: '',
  hostDirectives: [{ directive: YoutubePlayerParamsDirective, inputs: ['videoId'] }, YoutubePlayerDirective],
})
class HeadlessYoutubeComponent {
  youtube = inject(YOUTUBE_PLAYER_TOKEN);
}

@Component({
  selector: 'et-scenario-replay',
  imports: [YoutubePlayerComponent, HeadlessYoutubeComponent],
  template: `
    <et-youtube-player videoId="full-replay" />
    <et-scenario-headless-youtube videoId="trailer" />
  `,
})
class ReplayComponent {
  replay = viewChild.required(YoutubePlayerComponent);
  headless = viewChild.required(HeadlessYoutubeComponent);
}

@Component({
  selector: 'et-scenario-custom-slot',
  template: '',
  hostDirectives: [{ directive: YoutubePlayerParamsDirective, inputs: ['videoId'] }, YoutubePlayerSlotDirective],
})
class CustomYoutubeSlotComponent {
  slot = inject(YOUTUBE_PLAYER_SLOT_TOKEN);
}

@Component({
  selector: 'et-scenario-custom-slot-host',
  imports: [CustomYoutubeSlotComponent],
  template: `<et-scenario-custom-slot videoId="teaser" />`,
})
class CustomSlotHostComponent {
  custom = viewChild.required(CustomYoutubeSlotComponent);
}

@Component({
  selector: 'et-scenario-headless-twitch',
  template: '',
  hostDirectives: [
    { directive: TwitchPlayerParamsDirective, inputs: ['src', 'chat', 'startTime'] },
    TwitchPlayerDirective,
  ],
})
class HeadlessTwitchComponent {
  twitch = inject(TWITCH_PLAYER_TOKEN);
  stream: StreamPlayer = inject(STREAM_PLAYER_TOKEN);
}

@Component({
  selector: 'et-scenario-broadcasts',
  imports: [HeadlessTwitchComponent, STREAM_TWITCH_IMPORTS],
  template: `
    <et-scenario-headless-twitch [src]="src()" [startTime]="startTime()" chat />
    <et-twitch-player class="plain" src="1234567" />
    <et-twitch-player-slot src="https://www.twitch.tv/videos/555" />
  `,
})
class BroadcastsComponent {
  src = signal('https://www.twitch.tv/league_live');
  startTime = signal(0);
  headless = viewChild.required(HeadlessTwitchComponent);
  plain = viewChild.required(TwitchPlayerComponent);
  slot = viewChild.required(TwitchPlayerSlotComponent);
}

@Component({
  selector: 'et-scenario-headless-vimeo',
  template: '',
  hostDirectives: [{ directive: VimeoPlayerParamsDirective, inputs: ['videoId', 'startTime'] }, VimeoPlayerDirective],
})
class HeadlessVimeoComponent {
  vimeo = inject(VIMEO_PLAYER_TOKEN);
}

@Component({
  selector: 'et-scenario-documentary',
  imports: [HeadlessVimeoComponent, STREAM_VIMEO_IMPORTS],
  template: `
    <et-vimeo-player [videoId]="4242" [width]="480" />
    <et-scenario-headless-vimeo [startTime]="12" videoId="777" />
    <et-vimeo-player-slot videoId="88" />
  `,
})
class DocumentaryComponent {
  film = viewChild.required(VimeoPlayerComponent);
  headless = viewChild.required(HeadlessVimeoComponent);
  slot = viewChild.required(VimeoPlayerSlotComponent);
}

@Component({
  selector: 'et-scenario-headless-facebook',
  template: '',
  hostDirectives: [{ directive: FacebookPlayerParamsDirective, inputs: ['videoId', 'width'] }, FacebookPlayerDirective],
})
class HeadlessFacebookComponent {
  facebook = inject(FACEBOOK_PLAYER_TOKEN);
}

@Component({
  selector: 'et-scenario-social',
  imports: [HeadlessFacebookComponent, STREAM_IMPORTS, STREAM_FACEBOOK_IMPORTS],
  template: `
    @if (headless()) {
      <et-scenario-headless-facebook [width]="500" videoId="clip-1" />
      <et-facebook-player videoId="clip-3" />
    } @else {
      <et-facebook-player-slot videoId="clip-2" />
    }
  `,
})
class SocialComponent {
  headless = signal(true);
  facebook = viewChild(HeadlessFacebookComponent);
  plain = viewChild(FacebookPlayerComponent);
  slot = viewChild(FacebookPlayerSlotComponent);
}

@Component({
  selector: 'et-scenario-headless-tiktok',
  template: '',
  hostDirectives: [{ directive: TikTokPlayerParamsDirective, inputs: ['videoId'] }, TikTokPlayerDirective],
})
class HeadlessTikTokComponent {
  tiktok = inject(TIKTOK_PLAYER_TOKEN);
  params = inject(TikTokPlayerParamsDirective);
}

@Component({
  selector: 'et-scenario-shorts',
  imports: [HeadlessTikTokComponent, STREAM_IMPORTS, STREAM_TIKTOK_IMPORTS],
  template: `
    <et-scenario-headless-tiktok videoId="short-1" />
    <et-tiktok-player videoId="short-2" />
    <et-tiktok-player-slot videoId="short-3" />
  `,
})
class ShortsComponent {
  headless = viewChild.required(HeadlessTikTokComponent);
  plain = viewChild.required(TikTokPlayerComponent);
  slot = viewChild.required(TikTokPlayerSlotComponent);
}

@Component({
  selector: 'et-scenario-headless-embeds',
  template: '',
  hostDirectives: [{ directive: KickPlayerParamsDirective, inputs: ['channel', 'muted'] }, KickPlayerDirective],
})
class HeadlessKickComponent {
  kick = inject(KICK_PLAYER_TOKEN);
}

@Component({
  selector: 'et-scenario-headless-soop',
  template: '',
  hostDirectives: [{ directive: SoopPlayerParamsDirective, inputs: ['userId', 'videoId'] }, SoopPlayerDirective],
})
class HeadlessSoopComponent {
  soop = inject(SOOP_PLAYER_TOKEN);
}

@Component({
  selector: 'et-scenario-headless-dailymotion',
  template: '',
  hostDirectives: [
    { directive: DailymotionPlayerParamsDirective, inputs: ['videoId', 'startTime', 'width'] },
    DailymotionPlayerDirective,
  ],
})
class HeadlessDailymotionComponent {
  dailymotion = inject(DAILYMOTION_PLAYER_TOKEN);
}

@Component({
  selector: 'et-scenario-embeds',
  imports: [
    HeadlessKickComponent,
    HeadlessSoopComponent,
    HeadlessDailymotionComponent,
    STREAM_KICK_IMPORTS,
    STREAM_SOOP_IMPORTS,
    STREAM_DAILYMOTION_IMPORTS,
  ],
  template: `
    <et-scenario-headless-embeds class="kick" channel="arena" muted />
    <et-scenario-headless-soop class="soop-live" userId="caster" />
    <et-scenario-headless-soop class="soop-vod" videoId="9001" />
    <et-scenario-headless-dailymotion [startTime]="45" [width]="320" class="dailymotion" videoId="x8abc" />
    <et-kick-player class="kick-plain" channel="plain" />
    <et-soop-player class="soop-plain" userId="plain" />
    <et-dailymotion-player class="dailymotion-plain" videoId="plain" />
    <et-kick-player-slot class="kick-slot" channel="slot" />
    <et-soop-player-slot class="soop-slot" videoId="slot" />
    <et-dailymotion-player-slot class="dailymotion-slot" videoId="slot" />
  `,
})
class EmbedsComponent {
  kick = viewChild.required(HeadlessKickComponent);
  soop = viewChild.required(HeadlessSoopComponent);
  dailymotion = viewChild.required(HeadlessDailymotionComponent);
  plainKick = viewChild.required(KickPlayerComponent);
  plainSoop = viewChild.required(SoopPlayerComponent);
  plainDailymotion = viewChild.required(DailymotionPlayerComponent);
  soopSlot = viewChild.required(SoopPlayerSlotComponent);
  dailymotionSlot = viewChild.required(DailymotionPlayerSlotComponent);
}

@Component({
  selector: 'et-scenario-watch-party',
  imports: [STREAM_ALL_IMPORTS],
  template: `
    @if (showInline()) {
      <div class="inline"><et-kick-player-slot [channel]="channel()" /></div>
    }
    @if (showTheater()) {
      <div class="theater"><et-kick-player-slot [channel]="channel()" streamSlotPriority /></div>
    }
  `,
})
class WatchPartyComponent {
  channel = signal('arena');
  showInline = signal(true);
  showTheater = signal(false);
  slot = viewChild(KickPlayerSlotComponent);
}

@Component({
  selector: 'et-scenario-stream-settings',
  template: '',
})
class StreamSettingsComponent {
  labels = injectStreamLabels();
  loading = injectStreamPlayerLoadingConfig();
  error = injectStreamPlayerErrorConfig();
  source = inject(STREAM_LABELS);
}

@Component({
  selector: 'et-scenario-standalone-chrome',
  imports: [StreamPlayerLoadingComponent],
  template: `<et-stream-player-loading />`,
})
class StandaloneChromeComponent {}

describe('stream player scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideStreamManager(),
      provideStreamLabels({ playerFrame: (platform) => `${platform} stream` }),
      ...provideStreamPlayerLoadingConfig({ spinnerDiameter: 48 }),
      ...provideStreamPlayerErrorConfig({ retryButtonColor: 'danger' }),
      { provide: CSP_NONCE, useValue: 'nonce-123' },
      provideColorThemesWithTailwind4(COLOR_THEMES),
    ],
  });

  afterEach(() => {
    for (const src of [YT_API_URL, TWITCH_EMBED_URL, VIMEO_SDK_URL, FB_SDK_URL, 'https://cdn.example.com/sdk.js']) {
      scriptTag(src)?.remove();
    }

    for (const name of ['YT', 'Twitch', 'Vimeo', 'FB', 'fbAsyncInit']) delete globals()[name];
  });

  it('shows a spinner while the YouTube SDK loads and drops it once the player is ready', () => {
    const s = scenario();
    const players = installYoutube();
    const fixture = TestBed.createComponent(HighlightsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    const slotHost = query('et-youtube-player-slot', host);
    const slot = fixture.componentInstance.slot().slotDirective;

    expect(slot).toBeInstanceOf(StreamPlayerSlotDirective);
    expect(slot.slot.currentPlayerIdSignal()).toBe('youtube-match-recap');
    expect(slot.slot.currentState()).toEqual(DEFAULT_STREAM_PLAYER_STATE);

    const loading = query('et-stream-player-loading', slotHost);

    expect(loading.getAttribute('role')).toBe('status');
    expect(loading.getAttribute('aria-label')).toBe(DEFAULT_STREAM_LABELS.loading);
    expect(query('et-spinner', loading).style.getPropertyValue('--et-spinner-size')).toBe('48px');

    const script = scriptTag(YT_API_URL);

    expect(script?.getAttribute('nonce')).toBe('nonce-123');
    expect(players).toHaveLength(0);

    fireScript(s, YT_API_URL);

    const [player] = players;

    expect(player?.config.videoId).toBe('match-recap');
    expect(player?.config.width).toBe('640');
    expect(player?.config.playerVars?.start).toBe(30);
    expect(query('et-youtube-player', slotHost).contains(slotHost.querySelector('et-stream-player-loading'))).toBe(
      false,
    );

    player?.config.events?.onReady?.({ target: player as never });
    s.flush();

    expect(slot.slot.currentState().isReady).toBe(true);
    expect(slotHost.querySelector('et-stream-player-loading')).toBeNull();
  });

  it('swaps a failed SDK load for the error card and recovers through its retry button', async () => {
    const s = scenario();
    const players = installYoutube();
    const fixture = TestBed.createComponent(HighlightsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();
    fireScript(s, YT_API_URL, 'error');
    await s.settle();

    expect(scriptTag(YT_API_URL)).toBeNull();

    const slotHost = query('et-youtube-player-slot', host);
    const error = query('et-stream-player-error', slotHost);

    expect(slotHost.querySelector('et-stream-player-loading')).toBeNull();
    expect(error.getAttribute('role')).toBe('alert');
    expect(query('.et-stream-player-error-heading', error).textContent?.trim()).toBe(
      DEFAULT_STREAM_LABELS.errorHeading,
    );
    expect(fixture.componentInstance.slot().slotDirective.slot.currentState().error).not.toBeNull();

    const retry = query('button', error);

    expect(createStreamConfig().errorComponent).toBe(StreamPlayerErrorComponent);

    expect(retry.className).toContain('et-color--danger');

    retry.click();
    await s.settle();

    expect(slotHost.querySelector('et-stream-player-error')).toBeNull();
    expect(slotHost.querySelector('et-stream-player-loading')).not.toBeNull();

    fireScript(s, YT_API_URL);
    players[0]?.config.events?.onReady?.({ target: players[0] as never });
    await s.settle();

    expect(slotHost.querySelector('et-stream-player-loading')).toBeNull();
    expect(slotHost.querySelector('et-stream-player-error')).toBeNull();
  });

  it('controls a standalone YouTube player and tracks its playback state', async () => {
    const s = scenario();
    const players = installYoutube();
    const fixture = TestBed.createComponent(ReplayComponent);

    s.flush();
    fireScript(s, YT_API_URL);

    const replay = fixture.componentInstance.replay();
    const player = replay.player;
    const [yt] = players;

    if (!yt) throw new Error('no YT.Player');

    expect(player).toBeInstanceOf(YoutubePlayerDirective);
    expect(fixture.componentInstance.headless().youtube.thumbnail()).toContain('/vi/trailer/');
    expect(players.map((entry) => entry.config.videoId)).toEqual(['full-replay', 'trailer']);
    expect(player.CAPABILITIES.canSeek).toBe(true);
    expect(player.thumbnail()).toBe('https://img.youtube.com/vi/full-replay/mqdefault.jpg');

    yt.config.events?.onReady?.({ target: yt as never });
    await s.settle();

    player.play();
    player.seek(90);
    player.mute();
    expect(player.state().isMuted).toBe(true);
    player.unmute();
    player.pause();
    expect(yt.calls).toEqual(['play', 'seek:90', 'mute', 'unmute', 'pause']);

    yt.time = 10;
    yt.config.events?.onStateChange?.({ target: yt as never, data: 1 });
    s.tick();
    expect(player.state()).toMatchObject({ isPlaying: true, duration: 212, currentTime: 10 });

    yt.time = 11;
    s.tick(250);
    expect(player.state().currentTime).toBe(11);

    yt.config.events?.onStateChange?.({ target: yt as never, data: 0 });
    s.tick();
    expect(player.state()).toMatchObject({ isPlaying: false, isEnded: true });

    fixture.destroy();
    expect(yt.destroyed).toBe(true);
  });

  it('builds a slot of its own from the YouTube params and slot directives', () => {
    const s = scenario();
    const players = installYoutube();
    const fixture = TestBed.createComponent(CustomSlotHostComponent);

    s.flush();
    fireScript(s, YT_API_URL);

    const custom = fixture.componentInstance.custom();

    expect(custom.slot).toBeInstanceOf(YoutubePlayerSlotDirective);
    expect(custom.slot.slot.currentPlayerIdSignal()).toBe('youtube-teaser');
    expect(players[0]?.config.videoId).toBe('teaser');
    expect(query('et-scenario-custom-slot et-youtube-player')).toBeTruthy();
  });

  it('embeds a Twitch channel or video and follows the embed events', async () => {
    const s = scenario();
    const embeds = installTwitch();
    const fixture = TestBed.createComponent(BroadcastsComponent);

    s.flush();
    fireScript(s, TWITCH_EMBED_URL);

    const [channel, video] = embeds;

    if (!channel) throw new Error('no Twitch embed');

    expect(channel.options).toMatchObject({ channel: 'league_live', layout: 'video-with-chat' });
    expect(video?.options).toMatchObject({ video: '1234567', layout: 'video' });
    expect(fixture.componentInstance.plain().player).toBeInstanceOf(TwitchPlayerDirective);

    const { twitch, stream } = fixture.componentInstance.headless();

    expect(stream).toBe(twitch);

    channel.fire('ready');
    await s.settle();
    expect(twitch.state()).toMatchObject({ isReady: true, isMuted: true, duration: null });

    channel.time = 3;
    channel.fire('play');
    s.tick(250);
    expect(twitch.state()).toMatchObject({ isPlaying: true, currentTime: 3 });

    twitch.pause();
    twitch.mute();
    twitch.seek(60);
    expect(channel.calls).toEqual(['pause', 'muted:true', 'seek:60']);

    channel.fire('pause');
    s.tick();
    expect(twitch.state().isPlaying).toBe(false);

    channel.fire('ended');
    s.tick();
    expect(twitch.state().isEnded).toBe(true);

    fixture.componentInstance.src.set('https://www.twitch.tv/videos/987');
    fixture.componentInstance.startTime.set(3725);
    s.flush();

    expect(embeds.at(-1)?.options).toMatchObject({ video: '987', time: '1h2m5s' });
    expect(fixture.componentInstance.slot().slotDirective.slot.currentPlayerIdSignal()).toBe('twitch-video-555');
  });

  it('waits for the Vimeo player to become ready and relays its events', async () => {
    const s = scenario();
    const players = installVimeo();
    const fixture = TestBed.createComponent(DocumentaryComponent);

    s.flush();
    fireScript(s, VIMEO_SDK_URL);
    await s.settle();

    const [film, headless] = players;
    const vimeo = fixture.componentInstance.headless().vimeo;

    if (!headless) throw new Error('no Vimeo player');

    expect(film?.id).toBe(4242);
    expect(players.map((player) => player.id)).toContain('88');
    expect(fixture.componentInstance.slot().slotDirective.slot.currentState().isReady).toBe(true);
    expect(query('et-vimeo-player').style.width).toBe('480px');
    expect(fixture.componentInstance.film().player).toBeInstanceOf(VimeoPlayerDirective);
    expect(vimeo.state()).toMatchObject({ isReady: true, duration: 95 });
    expect(headless.calls).toEqual(['seek:12']);

    headless.fire('play', { duration: 95, seconds: 12, percent: 0.1 });
    s.tick();
    expect(vimeo.state()).toMatchObject({ isPlaying: true, currentTime: 12 });

    headless.fire('timeupdate', { duration: 96, seconds: 20, percent: 0.2 });
    headless.fire('ended', { duration: 96, seconds: 96, percent: 1 });
    s.tick();
    expect(vimeo.state()).toMatchObject({ isPlaying: false, isEnded: true, duration: 96, currentTime: 96 });

    vimeo.play();
    vimeo.pause();
    vimeo.mute();
    vimeo.seek(5);
    expect(headless.calls).toEqual(['seek:12', 'play', 'pause', 'muted:true', 'seek:5']);

    fixture.destroy();
    expect(headless.destroyed).toBe(true);
    expect(headless.listeners()).toBe(0);
  });

  it('loads the Facebook SDK once, parses the embed and reports the video ready', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SocialComponent);

    s.flush();
    fireScript(s, FB_SDK_URL);

    const { handlers, parsed } = installFacebook();

    (globals()['fbAsyncInit'] as () => void)();
    s.tick();

    const containers = Array.from(document.querySelectorAll<HTMLElement>('.fb-video'));
    const [embed] = containers;
    const videos = containers.map(() => createFacebookVideo());
    const [video] = videos;
    const facebook = fixture.componentInstance.facebook()?.facebook;

    if (!embed || !video) throw new Error('no Facebook embed');

    expect(embed.dataset['href']).toBe('https://www.facebook.com/video/clip-1');
    expect(embed.dataset['width']).toBe('500');
    expect(parsed).toHaveLength(2);
    expect(fixture.componentInstance.plain()?.player).toBeInstanceOf(FacebookPlayerDirective);
    expect(facebook).toBeInstanceOf(FacebookPlayerDirective);

    const initialHandlers = [...handlers];

    for (const handler of initialHandlers) {
      containers.forEach((container, index) =>
        handler({ type: 'video', id: container.id, instance: videos[index]?.player }),
      );
    }

    await s.settle();

    expect(facebook?.state().isReady).toBe(true);

    video.subscriptions.get('startedPlaying')?.();
    s.tick();
    expect(facebook?.state().isPlaying).toBe(true);

    video.subscriptions.get('finishedPlaying')?.();
    s.tick();
    expect(facebook?.state()).toMatchObject({ isPlaying: false, isEnded: true });

    facebook?.mute();
    facebook?.seek(8);
    expect(video.calls).toEqual(['mute', 'seek:8']);

    fixture.componentInstance.headless.set(false);
    s.tick();

    expect(initialHandlers.some((handler) => handlers.has(handler))).toBe(false);
    expect(videos.map((entry) => entry.subscriptions.size)).toEqual([0, 0]);
  });

  it('gives up on a Facebook video that never becomes ready', async () => {
    const s = scenario();

    installFacebook();

    const fixture = TestBed.createComponent(SocialComponent);

    fixture.componentInstance.headless.set(false);
    s.tick();
    s.frame();

    const slotHost = query('et-facebook-player-slot');

    expect(fixture.componentInstance.slot()?.slotDirective.slot.currentPlayerIdSignal()).toBe('facebook-clip-2');

    expect(slotHost.querySelector('et-stream-player-error')).toBeNull();

    s.tick(15_000);
    await s.settle();

    expect(slotHost.querySelector('et-stream-player-error')).not.toBeNull();
  });

  it('talks to the TikTok player over postMessage', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ShortsComponent);

    s.flush();

    const { tiktok, params } = fixture.componentInstance.headless();
    const iframe = query<HTMLIFrameElement>('et-scenario-headless-tiktok iframe');
    const frame = iframe.contentWindow;

    if (!frame) throw new Error('no TikTok frame');

    const post = vi.spyOn(frame, 'postMessage').mockImplementation(() => undefined);
    const send = (data: unknown) => {
      document.defaultView?.dispatchEvent(new MessageEvent('message', { data, source: frame }));
      s.tick();
    };

    expect(params.ASPECT_RATIO).toBe(9 / 16);
    expect(iframe.src).toBe('https://www.tiktok.com/player/v1/short-1?rel=0');
    expect(iframe.title).toBe('TikTok stream');
    expect(fixture.componentInstance.plain().player).toBeInstanceOf(TikTokPlayerDirective);
    expect(fixture.componentInstance.slot().slotDirective.slot.currentPlayerIdSignal()).toBe('tiktok-short-3');

    send({ 'x-tiktok-player': true, type: 'onPlayerReady' });
    expect(tiktok.state().isReady).toBe(true);

    send({ 'x-tiktok-player': true, type: 'onStateChange', value: 1 });
    send({ 'x-tiktok-player': true, type: 'onCurrentTime', value: { currentTime: 4, duration: 30 } });
    send({ 'x-tiktok-player': true, type: 'onMute', value: 1 });
    send({ type: 'onStateChange', value: 0 });
    expect(tiktok.state()).toMatchObject({ isPlaying: true, currentTime: 4, duration: 30, isMuted: true });

    tiktok.seek(7);
    tiktok.unmute();
    expect(post.mock.calls.map(([message]) => message)).toEqual([
      { 'x-tiktok-player': true, type: 'seekTo', value: 7 },
      { 'x-tiktok-player': true, type: 'unMute' },
    ]);

    send({ 'x-tiktok-player': true, type: 'onError', value: 'private video' });
    await s.settle();
    expect(String(tiktok.state().error)).toContain('private video');
  });

  it('builds the iframe embeds for Kick, SOOP and Dailymotion and marks them ready on load', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(EmbedsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    const kickFrame = query<HTMLIFrameElement>('.kick iframe', host);

    expect(kickFrame.src).toBe('https://player.kick.com/arena?parent=localhost&muted=true');
    expect(kickFrame.title).toBe('Kick stream');
    expect(query<HTMLIFrameElement>('.soop-live iframe', host).src).toBe('https://play.afreecatv.com/caster/embed');
    expect(query<HTMLIFrameElement>('.soop-vod iframe', host).src).toBe('https://vod.afreecatv.com/player/9001');

    const dailymotionFrame = query<HTMLIFrameElement>('.dailymotion iframe', host);

    expect(dailymotionFrame.src).toBe('https://www.dailymotion.com/embed/video/x8abc?autoplay=0&start=45');
    expect(dailymotionFrame.width).toBe('320');

    const embeds = fixture.componentInstance;
    const kick = embeds.kick().kick;
    const soop = embeds.soop().soop;
    const dailymotion = embeds.dailymotion().dailymotion;

    expect(embeds.plainKick().player).toBeInstanceOf(KickPlayerDirective);
    expect(embeds.plainSoop().player).toBeInstanceOf(SoopPlayerDirective);
    expect(embeds.plainDailymotion().player).toBeInstanceOf(DailymotionPlayerDirective);

    for (const player of [kick, soop, dailymotion]) {
      expect(player.CAPABILITIES.canPlay).toBe(false);
      expect(player.state().isReady).toBe(false);
      player.play();
      player.pause();
      player.mute();
      player.unmute();
      player.seek();
    }

    loadIframe(s, query('.kick', host));
    loadIframe(s, query('.soop-live', host));
    loadIframe(s, query('.dailymotion', host));

    expect(kick.state().isReady).toBe(true);
    expect(soop.state().isReady).toBe(true);
    expect(dailymotion.state().isReady).toBe(true);

    expect(embeds.soopSlot().slotDirective.slot.currentPlayerIdSignal()).toBe('soop-video-slot');
    expect(embeds.dailymotionSlot().slotDirective.slot.currentPlayerIdSignal()).toBe('dailymotion-slot');

    for (const slot of ['.kick-slot', '.soop-slot', '.dailymotion-slot']) {
      const slotHost = query(slot, host);

      expect(slotHost.querySelector('et-stream-player-loading')).not.toBeNull();
      loadIframe(s, slotHost);
      s.flush();
      expect(slotHost.querySelector('et-stream-player-loading')).toBeNull();
    }
  });

  it('moves one live player between slots without recreating its iframe', () => {
    const s = scenario();
    const manager = s.run(() => injectStreamManager());
    const fixture = TestBed.createComponent(WatchPartyComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    const iframe = query<HTMLIFrameElement>('.inline iframe', host);

    expect(manager.getPlayerElement('kick-arena')?.tagName).toBe('ET-KICK-PLAYER');
    expect(manager.hasSlotFor('kick-arena')).toBe(true);

    fixture.componentInstance.showTheater.set(true);
    s.flush();

    expect(query('.theater iframe', host)).toBe(iframe);
    expect(manager.resolveBestSlot('kick-arena')?.priority).toBe(true);

    fixture.componentInstance.showTheater.set(false);
    s.flush();

    expect(query('.inline iframe', host)).toBe(iframe);

    fixture.componentInstance.channel.set('studio');
    s.flush();

    expect(manager.getPlayerElement('kick-arena')).toBeNull();
    expect(manager.getPlayerElement('kick-studio')).not.toBeNull();
    expect(fixture.componentInstance.slot()?.slotDirective.slot.currentPlayerIdSignal()).toBe('kick-studio');
    expect(query<HTMLIFrameElement>('.inline iframe', host).src).toContain('/studio?');

    fixture.componentInstance.showInline.set(false);
    s.flush();

    expect(manager.getPlayerElement('kick-studio')).toBeNull();
    expect(host.querySelector('iframe')).toBeNull();
  });

  it('loads a custom SDK once per page and tags it with the CSP nonce', async () => {
    const s = scenario();
    const loader = s.run(() => injectStreamScriptLoader());
    const src = 'https://cdn.example.com/sdk.js';
    const first = loader.load(src);

    expect(loader.load(src)).toBe(first);

    const loaded = firstValueFrom(first);

    expect(scriptTag(src)?.getAttribute('nonce')).toBe('nonce-123');

    fireScript(s, src);
    await expect(loaded).resolves.toBeUndefined();
    expect(document.head.querySelectorAll(`script[src="${src}"]`)).toHaveLength(1);
  });

  it('reads the localized labels and overlay configs the stream chrome uses', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StreamSettingsComponent);
    const chrome = TestBed.createComponent(StandaloneChromeComponent);

    s.flush();

    const settings = fixture.componentInstance;

    expect(settings.labels().playerFrame('Kick')).toBe('Kick stream');
    expect(settings.labels().errorRetry).toBe(DEFAULT_STREAM_LABELS.errorRetry);
    expect(typeof settings.source).toBe('object');
    expect(settings.loading).toEqual({ spinnerDiameter: 48, spinnerStrokeWidth: 2 });
    expect(settings.error.retryButtonColor).toBe('danger');
    expect(query('et-stream-player-loading', chrome.nativeElement as HTMLElement).getAttribute('aria-label')).toBe(
      'Loading',
    );
  });
});
