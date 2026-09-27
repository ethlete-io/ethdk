import {
  ApplicationRef,
  ComponentRef,
  DestroyRef,
  EnvironmentInjector,
  Injector,
  Signal,
  WritableSignal,
  afterNextRender,
  computed,
  createComponent,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RuntimeError, injectHostElement, injectRenderer } from '@ethlete/core';
import { distinctUntilChanged, filter, map, take, tap } from 'rxjs';
import { STREAM_CONSENT_TOKEN, STREAM_USER_CONSENT_PROVIDER_TOKEN } from './consent/headless/stream-consent.directive';
import {
  STREAM_PLAYER_ERROR_CONTEXT_TOKEN,
  StreamPlayerErrorContext,
} from './error/headless/stream-player-error.directive';
import { STREAM_PIP_TOKEN } from './stream-pip.token';
import { injectStreamConfig } from './stream-config';
import { STREAM_ERROR_CODES } from './stream-errors';
import { injectStreamManager } from './stream-manager';
import { StreamPlayerId } from './stream-manager.types';
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
  currentPlayerIdSignal: WritableSignal<StreamPlayerId | null>;
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
  pipActivate(onBack?: () => void): void;
  pipDeactivate(): void;
};

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

  const currentPlayerIdSignal = signal<StreamPlayerId | null>(null);
  const currentPlayer = signal<StreamPlayer | null>(null);
  const currentState = computed(() => currentPlayer()?.state() ?? DEFAULT_STREAM_PLAYER_STATE);
  const capabilities = computed(() => currentPlayer()?.CAPABILITIES ?? NO_STREAM_PLAYER_CAPABILITIES);
  let consentComponentRef: ComponentRef<unknown> | null = null;
  let pipPlaceholderComponentRef: ComponentRef<unknown> | null = null;
  let loadingComponentRef: ComponentRef<unknown> | null = null;
  let errorComponentRef: ComponentRef<unknown> | null = null;

  const destroyLoadingComponent = () => {
    if (loadingComponentRef) {
      appRef.detachView(loadingComponentRef.hostView);
      loadingComponentRef.destroy();
      loadingComponentRef = null;
    }
  };

  const destroyErrorComponent = () => {
    if (errorComponentRef) {
      appRef.detachView(errorComponentRef.hostView);
      errorComponentRef.destroy();
      errorComponentRef = null;
    }
  };

  effect(() => {
    const newPlayerId = options.playerId();
    const oldPlayerId = currentPlayerIdSignal();

    if (!oldPlayerId || oldPlayerId === newPlayerId) return;

    streamManager.transferPlayer(oldPlayerId, newPlayerId);
    streamManager.unregisterSlot(el);
    streamManager.registerSlot({
      playerId: newPlayerId,
      priority: options.streamSlotPriority(),
      element: el,
      onPipBack: options.streamSlotOnPipBack(),
    });
    currentPlayerIdSignal.set(newPlayerId);
  });

  const createAndRegisterPlayer = () => {
    const currentPlayerId = options.playerId();
    const componentRef = options.createPlayer(envInjector, elementInjector);
    appRef.attachView(componentRef.hostView);

    const playerElement = componentRef.location.nativeElement as HTMLElement;
    const player = componentRef.injector.get<StreamPlayer>(STREAM_PLAYER_TOKEN);

    currentPlayer.set(player);

    streamManager.registerPlayer({
      id: currentPlayerId,
      element: playerElement,
      thumbnail: player.thumbnail,
      player,
      onDestroy: () => {
        appRef.detachView(componentRef.hostView);
        componentRef.destroy();
      },
    });
    streamManager.registerSlot({
      playerId: currentPlayerId,
      priority: options.streamSlotPriority(),
      element: el,
      onPipBack: options.streamSlotOnPipBack(),
    });

    const { loadingComponent, errorComponent, pipSlotPlaceholderComponent } = streamConfig;

    if (loadingComponent) {
      const loadingRef = createComponent(loadingComponent, {
        environmentInjector: envInjector,
        elementInjector,
      });
      appRef.attachView(loadingRef.hostView);
      renderer.appendChild(el, loadingRef.location.nativeElement);
      loadingComponentRef = loadingRef;
    }

    if (loadingComponent || errorComponent) {
      afterNextRender(
        () => {
          toObservable(player.state, { injector: componentRef.injector })
            .pipe(
              map((state) => {
                if (state.error !== null) return 'error' as const;
                if (state.isReady) return 'ready' as const;
                return 'loading' as const;
              }),
              distinctUntilChanged(),
              tap((displayState) => {
                if (displayState === 'loading') {
                  destroyErrorComponent();
                  if (loadingComponent && !loadingComponentRef) {
                    const loadingRef = createComponent(loadingComponent, {
                      environmentInjector: envInjector,
                      elementInjector,
                    });
                    appRef.attachView(loadingRef.hostView);
                    renderer.appendChild(el, loadingRef.location.nativeElement);
                    loadingComponentRef = loadingRef;
                  }
                } else if (displayState === 'ready') {
                  destroyLoadingComponent();
                  destroyErrorComponent();
                } else {
                  destroyLoadingComponent();
                  if (errorComponent && !errorComponentRef) {
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
                    const errorRef = createComponent(errorComponent, {
                      environmentInjector: envInjector,
                      elementInjector: errorInjector,
                    });
                    appRef.attachView(errorRef.hostView);
                    renderer.appendChild(el, errorRef.location.nativeElement);
                    errorComponentRef = errorRef;
                  }
                }
              }),
              takeUntilDestroyed(destroyRef),
            )
            .subscribe();
        },
        { injector: elementInjector },
      );
    }

    if (pipSlotPlaceholderComponent) {
      const placeholderRef = createComponent(pipSlotPlaceholderComponent, {
        environmentInjector: envInjector,
        elementInjector,
      });
      appRef.attachView(placeholderRef.hostView);
      renderer.appendChild(el, placeholderRef.location.nativeElement);
      pipPlaceholderComponentRef = placeholderRef;
    }
  };

  const showConsentComponent = () => {
    const { consentComponent } = streamConfig;

    if (!consentComponent) {
      return;
    }

    const consentRef = createComponent(consentComponent, {
      environmentInjector: envInjector,
      elementInjector,
    });
    appRef.attachView(consentRef.hostView);
    renderer.appendChild(el, consentRef.location.nativeElement);
    consentComponentRef = consentRef;

    const consentDirective = consentRef.injector.get(STREAM_CONSENT_TOKEN, null);

    if (!consentDirective) {
      if (ngDevMode) {
        throw new RuntimeError(
          STREAM_ERROR_CODES.MISSING_CONSENT_TOKEN,
          `[${options.directiveName ?? 'StreamPlayerSlot'}] consentComponent does not provide STREAM_CONSENT_TOKEN. Ensure the component has hostDirectives: [StreamConsentDirective].`,
          { element: el },
        );
      }

      return;
    }

    toObservable(consentDirective.isGranted, { injector: envInjector })
      .pipe(
        filter(Boolean),
        take(1),
        tap(() => {
          appRef.detachView(consentRef.hostView);
          consentRef.destroy();
          consentComponentRef = null;
          createAndRegisterPlayer();
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();
  };

  const init = () => {
    const currentPlayerId = options.playerId();
    currentPlayerIdSignal.set(currentPlayerId);

    const existingPlayer = streamManager.getPlayerEntry(currentPlayerId);

    if (existingPlayer) {
      currentPlayer.set(existingPlayer.player ?? null);
      streamManager.registerSlot({
        playerId: currentPlayerId,
        priority: options.streamSlotPriority(),
        element: el,
        onPipBack: options.streamSlotOnPipBack(),
      });

      const { pipSlotPlaceholderComponent } = streamConfig;
      if (pipSlotPlaceholderComponent && !pipPlaceholderComponentRef) {
        const placeholderRef = createComponent(pipSlotPlaceholderComponent, {
          environmentInjector: envInjector,
          elementInjector,
        });
        appRef.attachView(placeholderRef.hostView);
        renderer.appendChild(el, placeholderRef.location.nativeElement);
        pipPlaceholderComponentRef = placeholderRef;
      }

      return;
    }

    const { consentComponent } = streamConfig;

    if (consentHandler?.isGranted()) {
      createAndRegisterPlayer();

      return;
    }

    if (!consentHandler && !consentComponent) {
      createAndRegisterPlayer();

      return;
    }

    if (consentHandler && !consentComponent) {
      toObservable(consentHandler.isGranted, { injector: envInjector })
        .pipe(
          filter(Boolean),
          take(1),
          tap(() => createAndRegisterPlayer()),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe();

      return;
    }

    showConsentComponent();
  };

  const destroy = () => {
    if (currentPlayerIdSignal()) {
      streamManager.unregisterSlot(el);
    }

    if (consentComponentRef) {
      appRef.detachView(consentComponentRef.hostView);
      consentComponentRef.destroy();
      consentComponentRef = null;
    }

    if (pipPlaceholderComponentRef) {
      appRef.detachView(pipPlaceholderComponentRef.hostView);
      pipPlaceholderComponentRef.destroy();
      pipPlaceholderComponentRef = null;
    }

    destroyLoadingComponent();
    destroyErrorComponent();
  };

  const pipActivate = (onBack?: () => void) =>
    streamPip?.manager.pipActivate(el, {
      onBack,
      aspectRatio: options.aspectRatio,
      pipChromeComponent: streamPip.options.pipChromeComponent ?? undefined,
      pipChromeConfig: streamPip.options.pipChrome,
    });

  const pipDeactivate = () => {
    const id = currentPlayerIdSignal();

    if (id) {
      streamPip?.manager.pipDeactivate(id);
    }
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

  afterNextRender(() => init());
  destroyRef.onDestroy(() => destroy());

  return {
    currentPlayerIdSignal,
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
