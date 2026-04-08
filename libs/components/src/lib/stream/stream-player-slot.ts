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
import { injectHostElement } from '@ethlete/core';
import { distinctUntilChanged, filter, map, take, tap } from 'rxjs';
import { STREAM_CONSENT_TOKEN, STREAM_USER_CONSENT_PROVIDER_TOKEN } from './consent/headless/stream-consent.directive';
import {
  STREAM_PLAYER_ERROR_CONTEXT_TOKEN,
  StreamPlayerErrorContext,
} from './error/headless/stream-player-error.directive';
import { injectPipChromeManager } from './pip-chrome-manager';
import { injectPipManager } from './pip-manager';
import { injectStreamConfig } from './stream-config';
import { streamError } from './stream-errors';
import { injectStreamManager } from './stream-manager';
import { StreamPlayerId } from './stream-manager.types';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from './stream-player';
import { DEFAULT_STREAM_PLAYER_STATE, StreamPlayerState } from './stream.types';

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
  pipActivate(onBack?: () => void): void;
  pipDeactivate(): void;
};

export const createStreamPlayerSlot = (options: StreamPlayerSlotOptions): StreamPlayerSlotHandle => {
  const streamManager = injectStreamManager();
  const pipManager = injectPipManager();
  injectPipChromeManager();
  const el = injectHostElement<HTMLElement>();
  const appRef = inject(ApplicationRef);
  const envInjector = inject(EnvironmentInjector);
  const elementInjector = inject(Injector);
  const destroyRef = inject(DestroyRef);
  const streamConfig = injectStreamConfig();
  const consentHandler = inject(STREAM_USER_CONSENT_PROVIDER_TOKEN, { optional: true });

  const currentPlayerIdSignal = signal<StreamPlayerId | null>(null);
  const currentState = signal<StreamPlayerState>(DEFAULT_STREAM_PLAYER_STATE);
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

  const createAndRegisterPlayer = (currentPlayerId: StreamPlayerId) => {
    const componentRef = options.createPlayer(envInjector, elementInjector);
    appRef.attachView(componentRef.hostView);

    const playerElement = componentRef.location.nativeElement as HTMLElement;
    const player = componentRef.injector.get<StreamPlayer>(STREAM_PLAYER_TOKEN);

    effect(() => currentState.set(player.state()), { injector: componentRef.injector });

    streamManager.registerPlayer({
      id: currentPlayerId,
      element: playerElement,
      thumbnail: player.thumbnail,
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
      el.appendChild(loadingRef.location.nativeElement);
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
                    el.appendChild(loadingRef.location.nativeElement);
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
                    el.appendChild(errorRef.location.nativeElement);
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
      el.appendChild(placeholderRef.location.nativeElement);
      pipPlaceholderComponentRef = placeholderRef;
    }
  };

  const showConsentComponent = (currentPlayerId: StreamPlayerId) => {
    const { consentComponent } = streamConfig;

    if (!consentComponent) {
      return;
    }

    const consentRef = createComponent(consentComponent, {
      environmentInjector: envInjector,
      elementInjector,
    });
    appRef.attachView(consentRef.hostView);
    el.appendChild(consentRef.location.nativeElement);
    consentComponentRef = consentRef;

    const consentDirective = consentRef.injector.get(STREAM_CONSENT_TOKEN, null);

    if (!consentDirective) {
      streamError(
        'MISSING_CONSENT_TOKEN',
        `[${options.directiveName ?? 'StreamPlayerSlot'}] consentComponent does not provide STREAM_CONSENT_TOKEN. ` +
          'Ensure the component has hostDirectives: [StreamConsentDirective].',
        false,
      );

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
          createAndRegisterPlayer(currentPlayerId);
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();
  };

  const init = () => {
    const currentPlayerId = options.playerId();
    currentPlayerIdSignal.set(currentPlayerId);

    if (streamManager.getPlayerElement(currentPlayerId)) {
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
        el.appendChild(placeholderRef.location.nativeElement);
        pipPlaceholderComponentRef = placeholderRef;
      }

      return;
    }

    const { consentComponent } = streamConfig;

    if (consentHandler?.isGranted()) {
      createAndRegisterPlayer(currentPlayerId);

      return;
    }

    if (!consentHandler && !consentComponent) {
      createAndRegisterPlayer(currentPlayerId);

      return;
    }

    if (consentHandler && !consentComponent) {
      toObservable(consentHandler.isGranted, { injector: envInjector })
        .pipe(
          filter(Boolean),
          take(1),
          tap(() => createAndRegisterPlayer(currentPlayerId)),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe();

      return;
    }

    showConsentComponent(currentPlayerId);
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

  const pipActivate = (onBack?: () => void) => pipManager.pipActivate(el, { onBack, aspectRatio: options.aspectRatio });

  const pipDeactivate = () => {
    const id = currentPlayerIdSignal();

    if (id) {
      pipManager.pipDeactivate(id);
    }
  };

  afterNextRender(() => init());
  destroyRef.onDestroy(() => destroy());

  return { currentPlayerIdSignal, currentState, pipActivate, pipDeactivate };
};
