import {
  Component,
  Directive,
  InjectionToken,
  Provider,
  Signal,
  Type,
  ViewEncapsulation,
  createComponent,
  inject,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConsentHandler } from '@ethlete/core';
import { mountControl } from '../../testing/control-driver';
import { directiveAt, flushFrames, query } from '../../testing/driver-core';
import {
  STREAM_USER_CONSENT_PROVIDER_TOKEN,
  StreamConsentDirective,
} from '../consent/headless/stream-consent.directive';
import { injectPipManager } from '../pip-manager';
import { provideStreamConfig } from '../stream-config';
import { injectStreamManager } from '../stream-manager';
import { StreamPlayerId, StreamSlotEntry } from '../stream-manager.types';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from '../stream-player';
import { createStreamPlayerSlot } from '../stream-player-slot';
import { DEFAULT_STREAM_PLAYER_STATE, StreamPlayerCapabilities, StreamPlayerState } from '../stream.types';

const DEFAULT_TEST_PLAYER_ID = 'youtube-old';

const ALL_CAPABILITIES: StreamPlayerCapabilities = {
  canPlay: true,
  canPause: true,
  canMute: true,
  canSeek: true,
  canGetDuration: true,
  isLiveCapable: false,
  hasThumbnail: false,
};

export type FakeStreamPlayer = StreamPlayer & {
  /** Patches the reported state the way a platform SDK event would. */
  setState: (patch: Partial<StreamPlayerState>) => void;
  setThumbnail: (url: string | null) => void;
  /** Playback methods called on this player, in order (`seek` records `seek:<seconds>`). */
  calls: string[];
};

/** A `StreamPlayer` with no platform SDK behind it: it records commands and reports what a test sets. */
export const createFakeStreamPlayer = (capabilities: Partial<StreamPlayerCapabilities> = {}): FakeStreamPlayer => {
  const state = signal(DEFAULT_STREAM_PLAYER_STATE);
  const thumbnail = signal<string | null>(null);
  const calls: string[] = [];
  const record = (name: string) => () => void calls.push(name);

  return {
    CAPABILITIES: { ...ALL_CAPABILITIES, ...capabilities },
    state,
    thumbnail,
    play: record('play'),
    pause: record('pause'),
    mute: record('mute'),
    unmute: record('unmute'),
    seek: (seconds) => void calls.push(`seek:${seconds}`),
    retry: record('retry'),
    setState: (patch) => state.update((current) => ({ ...current, ...patch })),
    setThumbnail: (url) => thumbnail.set(url),
    calls,
  };
};

/** Stands in for a platform player component (`et-youtube-player` and friends). */
@Component({
  selector: 'et-fake-stream-player',
  template: '',
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: STREAM_PLAYER_TOKEN, useFactory: () => createFakeStreamPlayer() }],
})
export class FakeStreamPlayerComponent {
  public readonly player = inject(STREAM_PLAYER_TOKEN) as FakeStreamPlayer;
}

/** Stands in for the configured `loadingComponent` / `errorComponent`. */
@Component({
  selector: 'et-fake-stream-chrome',
  template: '',
  encapsulation: ViewEncapsulation.None,
})
export class FakeStreamChromeComponent {}

/** A consent gate that satisfies `STREAM_CONSENT_TOKEN`, as a real consent component must. */
@Component({
  selector: 'et-fake-stream-consent',
  template: '',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [StreamConsentDirective],
})
export class FakeStreamConsentComponent {}

export type StreamDriverPlayerOptions = {
  onDestroy?: () => void;
  thumbnail?: Signal<string | null>;
};

export type StreamDriverSlotOptions = Partial<Pick<StreamSlotEntry, 'priority' | 'onPipBack'>>;

/**
 * Drives `StreamManager` / `PipManager` directly, without mounting a slot: register players and
 * slots, then assert where the player element currently lives (`parentOf`, `isParked`).
 */
export const createStreamDriver = () => {
  const { pipManager, streamManager } = TestBed.runInInjectionContext(() => ({
    pipManager: injectPipManager(),
    streamManager: injectStreamManager(),
  }));

  const destroyedPlayers: StreamPlayerId[] = [];

  const addPlayer = (playerId: StreamPlayerId, options: StreamDriverPlayerOptions = {}) => {
    const element = document.createElement('div');

    streamManager.registerPlayer({
      id: playerId,
      element,
      thumbnail: options.thumbnail,
      onDestroy: () => {
        destroyedPlayers.push(playerId);
        options.onDestroy?.();
      },
    });

    return element;
  };

  const addSlot = (playerId: StreamPlayerId, { priority = false, onPipBack }: StreamDriverSlotOptions = {}) => {
    const element = document.createElement('div');

    document.body.appendChild(element);
    streamManager.registerSlot({ playerId, priority, element, onPipBack });

    return element;
  };

  const parentOf = (playerId: StreamPlayerId) => streamManager.getPlayerElement(playerId)?.parentElement ?? null;

  return {
    streamManager,
    pipManager,
    addPlayer,
    addSlot,

    /** Ids whose `onDestroy` the manager has fired. */
    destroyedPlayers,

    /** The element the player currently lives in, or `null` once the player is unregistered. */
    parentOf,

    /** True while the player sits in the manager's body-level container rather than a slot. */
    isParked: (playerId: StreamPlayerId) => parentOf(playerId)?.classList.contains('et-stream-manager') ?? false,

    /** Adopts the player into a fresh body-level host, as a `pip-player` component does. */
    attachToPipHost: (playerId: StreamPlayerId) => {
      const host = document.createElement('div');
      const element = streamManager.getPlayerElement(playerId);

      document.body.appendChild(host);
      if (element) host.appendChild(element);

      return host;
    },

    /** jsdom measures every element as 0x0, and the pip exit animations only run on measurable rects. */
    measure: (element: HTMLElement, width: number, height: number) => {
      element.getBoundingClientRect = () =>
        ({ x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}) }) as DOMRect;
    },

    advance: () => flushFrames(),
  };
};

export type StreamDriver = ReturnType<typeof createStreamDriver>;

export type StreamSlotDriverOptions = {
  /** @default 'youtube-old' */
  playerId?: StreamPlayerId;
  /** @default false */
  priority?: boolean;
  /** Rendered as the slot's consent gate; `null` gates on the consent handler alone. @default null */
  consentComponent?: Type<unknown> | null;
  /** Whether consent is already granted when the slot initialises. @default false */
  consentGranted?: boolean;
  providers?: Provider[];
};

const STREAM_SLOT_TEST_OPTIONS = new InjectionToken<StreamSlotDriverOptions>('STREAM_SLOT_TEST_OPTIONS');

@Directive({ selector: '[etTestStreamSlot]' })
class StreamSlotTestDirective {
  private readonly options = inject(STREAM_SLOT_TEST_OPTIONS);

  public readonly playerId = signal(this.options.playerId ?? DEFAULT_TEST_PLAYER_ID);
  public readonly priority = signal(this.options.priority ?? false);
  public readonly onPipBack = signal<(() => void) | undefined>(undefined);

  public readonly slot = createStreamPlayerSlot({
    playerId: this.playerId,
    aspectRatio: 16 / 9,
    streamSlotPriority: this.priority,
    streamSlotOnPipBack: this.onPipBack,
    createPlayer: (envInjector, elementInjector) =>
      createComponent(FakeStreamPlayerComponent, { environmentInjector: envInjector, elementInjector }),
  });
}

@Component({
  selector: 'et-test-stream-slot-host',
  template: '<div etTestStreamSlot></div>',
  encapsulation: ViewEncapsulation.None,
  imports: [StreamSlotTestDirective],
})
class StreamSlotTestHostComponent {}

/**
 * Mounts a host directive built on `createStreamPlayerSlot` with a fake platform player behind it,
 * plus the consent handler and stream config the slot reads at init.
 */
export const createStreamSlotDriver = (options: StreamSlotDriverOptions = {}) => {
  const isGranted = signal(options.consentGranted ?? false);
  const consentHandler: ConsentHandler = {
    isGranted,
    grant: () => isGranted.set(true),
    revoke: () => isGranted.set(false),
  };

  TestBed.resetTestingModule();

  const fixture = mountControl(StreamSlotTestHostComponent, [
    { provide: STREAM_SLOT_TEST_OPTIONS, useValue: options },
    { provide: STREAM_USER_CONSENT_PROVIDER_TOKEN, useValue: consentHandler },
    ...provideStreamConfig({
      consentComponent: options.consentComponent ?? null,
      loadingComponent: FakeStreamChromeComponent,
      errorComponent: FakeStreamChromeComponent,
    }),
    ...(options.providers ?? []),
  ]);

  const directive = () => directiveAt(fixture, StreamSlotTestDirective, '[etTestStreamSlot]');

  return {
    fixture,
    consentHandler,

    /** The slot handle under test. */
    slot: () => directive().slot,

    setPlayerId: (playerId: StreamPlayerId) => directive().playerId.set(playerId),

    grant: () => consentHandler.grant(),

    /** The rendered consent gate, or `null` when none is configured or it has been destroyed. */
    consentHost: () => query(fixture, 'et-fake-stream-consent'),

    playerElementFor: (playerId: StreamPlayerId) =>
      TestBed.runInInjectionContext(() => injectStreamManager()).getPlayerElement(playerId),

    settle: async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    },
  };
};

export type StreamSlotDriver = ReturnType<typeof createStreamSlotDriver>;
