import {
  ApplicationRef,
  ComponentRef,
  DestroyRef,
  EnvironmentInjector,
  ErrorHandler,
  Injector,
  Signal,
  Type,
  afterNextRender,
  computed,
  createComponent,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RuntimeError, injectHostElement, injectRenderer } from '@ethlete/core';
import {
  STREAM_CONSENT_TOKEN,
  STREAM_USER_CONSENT_PROVIDER_TOKEN,
  StreamConsentDirective,
} from './consent/headless/stream-consent.directive';
import {
  STREAM_PLAYER_ERROR_CONTEXT_TOKEN,
  StreamPlayerErrorContext,
} from './error/headless/stream-player-error.directive';
import { STREAM_PIP_TOKEN } from './stream-pip.token';
import { injectStreamConfig } from './stream-config';
import { STREAM_ERROR_CODES } from './stream-errors';
import { injectStreamManager } from './stream-manager';
import { StreamPlayerId, StreamSlotEntry } from './stream-manager.types';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from './stream-player';
import {
  DEFAULT_STREAM_PLAYER_STATE,
  NO_STREAM_PLAYER_CAPABILITIES,
  StreamPlayerCapabilities,
  StreamPlayerState,
} from './stream.types';

export type StreamPlayerSlotOptions = {
  /** Reactive player id derived from platform-specific params (e.g. `computed(() => \`youtube-\${params.videoId()}\`)`). */
  playerId: Signal<StreamPlayerId>;
  /** Natural aspect ratio (width / height) of the player. Passed to PIP entries so the chrome can resize accordingly. */
  aspectRatio: number;
  /** Forwarded from the host directive's `streamSlotPriority` input. */
  streamSlotPriority: Signal<boolean>;
  /** Forwarded from the host directive's `streamSlotOnPipBack` input. */
  streamSlotOnPipBack: Signal<(() => void) | undefined>;
  /**
   * Creates and returns the platform player `ComponentRef`.
   * Receives the environment and element injectors so input bindings have the
   * correct injection context.
   */
  createPlayer: (envInjector: EnvironmentInjector, elementInjector: Injector) => ComponentRef<unknown>;
  /** Used in dev-mode warnings to identify which directive misconfigured consent. */
  directiveName?: string;
};

export type StreamPlayerSlotHandle = {
  /** The id of the player the slot is bound to, or `null` before the slot first syncs. */
  currentPlayerId: Signal<StreamPlayerId | null>;
  currentState: Signal<StreamPlayerState>;
  /** What the slot's player supports. All `false` while the slot has no player yet. */
  capabilities: Signal<StreamPlayerCapabilities>;
  /**
   * Playback controls for the slot's player. Each returns `true` if the command was sent, and `false` if
   * the slot has no ready player or the player lacks the matching capability.
   */
  play(): boolean;
  pause(): boolean;
  mute(): boolean;
  unmute(): boolean;
  seek(seconds: number): boolean;
  /**
   * Moves the slot's player into picture-in-picture. Returns `false` when it could not: no
   * `provideStreamPip()` is in scope, the slot has no player yet, or the player is already in PiP.
   */
  pipActivate(onBack?: () => void): boolean;
  /** Brings the slot's player back from picture-in-picture. Returns `false` when it was not in PiP. */
  pipDeactivate(): boolean;
};

type StreamOverlay = { player: StreamPlayer; display: 'loading' | 'ready' | 'error' };

export const createStreamPlayerSlot = (options: StreamPlayerSlotOptions): StreamPlayerSlotHandle => {
  const streamManager = injectStreamManager();
  const streamPip = inject(STREAM_PIP_TOKEN, { optional: true });
  const el = injectHostElement<HTMLElement>();
  const appRef = inject(ApplicationRef);
  const envInjector = inject(EnvironmentInjector);
  const elementInjector = inject(Injector);
  const destroyRef = inject(DestroyRef);
  const streamConfig = injectStreamConfig();
  const renderer = injectRenderer();
  const consentHandler = inject(STREAM_USER_CONSENT_PROVIDER_TOKEN, { optional: true });
  const errorHandler = inject(ErrorHandler);

  const isInitialized = signal(false);
  const currentPlayerIdSignal = signal<StreamPlayerId | null>(null);
  const currentPlayer = signal<StreamPlayer | null>(null);
  const currentState = computed(() => currentPlayer()?.state() ?? DEFAULT_STREAM_PLAYER_STATE);
  const capabilities = computed(() => currentPlayer()?.CAPABILITIES ?? NO_STREAM_PLAYER_CAPABILITIES);
  const consentGate = signal<StreamConsentDirective | null>(null);
  const hasLocalConsent = signal(false);

  let hostedPlayerElement: HTMLElement | null = null;
  let createdPlayerElement: HTMLElement | null = null;
  let consentComponentRef: ComponentRef<unknown> | null = null;
  let pipPlaceholderComponentRef: ComponentRef<unknown> | null = null;
  let loadingComponentRef: ComponentRef<unknown> | null = null;
  let errorComponentRef: ComponentRef<unknown> | null = null;
  let overlayPlayer: StreamPlayer | null = null;

  const isConsentGranted = computed(() => {
    if (consentHandler) return consentHandler.isGranted();
    if (!streamConfig.consentComponent) return true;

    return hasLocalConsent() || (consentGate()?.isGranted() ?? false);
  });

  const isHostingSlot = computed(() => {
    streamManager.revision();
    const playerId = currentPlayerIdSignal();

    return !!playerId && !!currentPlayer() && streamManager.resolveBestSlot(playerId)?.element === el;
  });

  const overlay = computed<StreamOverlay | null>(
    () => {
      const player = currentPlayer();
      if (!player || !isHostingSlot()) return null;

      const { error, isReady } = player.state();

      return { player, display: error !== null ? 'error' : isReady ? 'ready' : 'loading' };
    },
    { equal: (a, b) => a?.player === b?.player && a?.display === b?.display },
  );

  const mountComponent = (component: Type<unknown>, injector: Injector = elementInjector) => {
    const ref = createComponent(component, { environmentInjector: envInjector, elementInjector: injector });
    appRef.attachView(ref.hostView);
    renderer.appendChild(el, ref.location.nativeElement);

    return ref;
  };

  const unmountComponent = (ref: ComponentRef<unknown> | null) => {
    if (ref) {
      appRef.detachView(ref.hostView);
      ref.destroy();
    }

    return null;
  };

  const renderOverlay = (next: StreamOverlay | null) => {
    if (next?.player !== overlayPlayer) {
      loadingComponentRef = unmountComponent(loadingComponentRef);
      errorComponentRef = unmountComponent(errorComponentRef);
      overlayPlayer = next?.player ?? null;
    }

    const display = next?.display ?? 'ready';
    const { loadingComponent, errorComponent } = streamConfig;

    if (display !== 'loading') loadingComponentRef = unmountComponent(loadingComponentRef);
    if (display !== 'error') errorComponentRef = unmountComponent(errorComponentRef);

    if (display === 'loading' && loadingComponent && !loadingComponentRef) {
      loadingComponentRef = mountComponent(loadingComponent);
    }

    if (next && display === 'error' && errorComponent && !errorComponentRef) {
      const { player } = next;
      const errorInjector = Injector.create({
        parent: elementInjector,
        providers: [
          {
            provide: STREAM_PLAYER_ERROR_CONTEXT_TOKEN,
            useValue: {
              error: computed(() => player.state().error),
              retry: () => player.retry(),
            } satisfies StreamPlayerErrorContext,
          },
        ],
      });

      errorComponentRef = mountComponent(errorComponent, errorInjector);
    }
  };

  const showConsentGate = () => {
    const { consentComponent } = streamConfig;
    if (!consentComponent || consentComponentRef) return;

    consentComponentRef = mountComponent(consentComponent);

    const consentDirective = consentComponentRef.injector.get(STREAM_CONSENT_TOKEN, null);

    if (!consentDirective) {
      if (ngDevMode) {
        errorHandler.handleError(
          new RuntimeError(
            STREAM_ERROR_CODES.MISSING_CONSENT_TOKEN,
            `[${options.directiveName ?? 'StreamPlayerSlot'}] consentComponent does not provide STREAM_CONSENT_TOKEN. Ensure the component has hostDirectives: [StreamConsentDirective].`,
            { element: el },
          ),
        );
      }

      return;
    }

    consentGate.set(consentDirective);
  };

  const hideConsentGate = () => {
    if (!consentHandler && consentGate()?.isGranted()) hasLocalConsent.set(true);

    consentComponentRef = unmountComponent(consentComponentRef);
    consentGate.set(null);
  };

  const syncSlotEntry = (entry: StreamSlotEntry) => {
    const registered = streamManager.getSlot(el);

    if (
      registered?.playerId === entry.playerId &&
      registered.priority === entry.priority &&
      registered.onPipBack === entry.onPipBack
    ) {
      return;
    }

    streamManager.registerSlot(entry);
  };

  const hostPlayer = (entry: StreamSlotEntry) => {
    const playerEntry = streamManager.getPlayerEntry(entry.playerId);
    if (!playerEntry) return;

    hideConsentGate();
    syncSlotEntry(entry);
    hostedPlayerElement = playerEntry.element;
    currentPlayer.set(playerEntry.player ?? null);

    const { pipSlotPlaceholderComponent } = streamConfig;

    if (pipSlotPlaceholderComponent && !pipPlaceholderComponentRef) {
      pipPlaceholderComponentRef = mountComponent(pipSlotPlaceholderComponent);
    }
  };

  const createPlayer = (playerId: StreamPlayerId) => {
    const componentRef = options.createPlayer(envInjector, elementInjector);
    appRef.attachView(componentRef.hostView);

    const element = componentRef.location.nativeElement as HTMLElement;
    const player = componentRef.injector.get<StreamPlayer>(STREAM_PLAYER_TOKEN);

    streamManager.registerPlayer({
      id: playerId,
      element,
      thumbnail: player.thumbnail,
      player,
      onDestroy: () => {
        appRef.detachView(componentRef.hostView);
        componentRef.destroy();
      },
    });
    createdPlayerElement = element;
  };

  const leavePip = (playerId: StreamPlayerId) => {
    if (streamPip && streamManager.isPlayerInPip(playerId)) {
      streamPip.manager.pipDeactivate(playerId, { skipAnimation: true });
    }
  };

  const releasePlayer = () => {
    hostedPlayerElement = null;
    createdPlayerElement = null;
    currentPlayer.set(null);

    if (streamManager.getSlot(el)) streamManager.unregisterSlot(el);
  };

  const rebindPlayer = (fromId: StreamPlayerId, entry: StreamSlotEntry) => {
    const ownsPlayer = createdPlayerElement === hostedPlayerElement;

    if (ownsPlayer && streamManager.transferPlayer(fromId, entry.playerId)) {
      currentPlayerIdSignal.set(entry.playerId);
      syncSlotEntry(entry);

      return true;
    }

    releasePlayer();

    // The player's inputs are bound to this slot's params, so it would follow the new id.
    if (ownsPlayer) {
      leavePip(fromId);
      streamManager.unregisterPlayer(fromId);
    }

    return false;
  };

  const sync = (entry: StreamSlotEntry, isGranted: boolean) => {
    const boundId = currentPlayerIdSignal();
    const isRevoked = !!consentHandler && !isGranted;

    if (hostedPlayerElement && boundId) {
      if (isRevoked) {
        leavePip(boundId);
        releasePlayer();
      } else if (streamManager.getPlayerElement(boundId) !== hostedPlayerElement) {
        releasePlayer();
      } else if (boundId !== entry.playerId) {
        if (rebindPlayer(boundId, entry)) return;
      } else {
        syncSlotEntry(entry);

        return;
      }
    }

    currentPlayerIdSignal.set(entry.playerId);

    if (!isRevoked && streamManager.getPlayerEntry(entry.playerId)) {
      hostPlayer(entry);

      return;
    }

    if (isGranted) {
      createPlayer(entry.playerId);
      hostPlayer(entry);

      return;
    }

    showConsentGate();
  };

  effect(() => {
    if (!isInitialized()) return;

    const entry: StreamSlotEntry = {
      playerId: options.playerId(),
      priority: options.streamSlotPriority(),
      element: el,
      onPipBack: options.streamSlotOnPipBack(),
    };
    const isGranted = isConsentGranted();
    streamManager.revision();

    untracked(() => sync(entry, isGranted));
  });

  effect(() => {
    const next = overlay();

    untracked(() => renderOverlay(next));
  });

  const destroy = () => {
    if (streamManager.getSlot(el)) streamManager.unregisterSlot(el);

    consentComponentRef = unmountComponent(consentComponentRef);
    pipPlaceholderComponentRef = unmountComponent(pipPlaceholderComponentRef);
    loadingComponentRef = unmountComponent(loadingComponentRef);
    errorComponentRef = unmountComponent(errorComponentRef);
  };

  const reportMissingPip = () => {
    if (ngDevMode && !streamPip) {
      errorHandler.handleError(
        new RuntimeError(
          STREAM_ERROR_CODES.MISSING_STREAM_PIP_PROVIDER,
          `[${options.directiveName ?? 'StreamPlayerSlot'}] pipActivate() / pipDeactivate() need picture-in-picture. Add provideStreamPip() to the injector the slot is created in.`,
          { element: el },
        ),
      );
    }
  };

  const pipActivate = (onBack?: () => void) => {
    if (!streamPip) {
      reportMissingPip();

      return false;
    }

    return streamPip.manager.pipActivate(el, {
      onBack,
      aspectRatio: options.aspectRatio,
      pipChromeComponent: streamPip.options.pipChromeComponent ?? undefined,
      pipChromeConfig: streamPip.options.pipChrome,
    });
  };

  const pipDeactivate = () => {
    if (!streamPip) {
      reportMissingPip();

      return false;
    }

    const id = currentPlayerIdSignal();

    return !!id && streamPip.manager.pipDeactivate(id);
  };

  const control = (capability: keyof StreamPlayerCapabilities, command: (player: StreamPlayer) => void) => {
    const player = currentPlayer();

    if (!player?.CAPABILITIES[capability] || !player.state().isReady) return false;

    command(player);

    return true;
  };

  const play = () => control('canPlay', (player) => player.play());
  const pause = () => control('canPause', (player) => player.pause());
  const mute = () => control('canMute', (player) => player.mute());
  const unmute = () => control('canMute', (player) => player.unmute());
  const seek = (seconds: number) => control('canSeek', (player) => player.seek(seconds));

  afterNextRender(() => isInitialized.set(true));
  destroyRef.onDestroy(() => destroy());

  return {
    currentPlayerId: currentPlayerIdSignal.asReadonly(),
    currentState,
    capabilities,
    play,
    pause,
    mute,
    unmute,
    seek,
    pipActivate,
    pipDeactivate,
  };
};
