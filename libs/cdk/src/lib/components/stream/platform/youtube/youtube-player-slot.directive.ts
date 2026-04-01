import {
  ApplicationRef,
  ComponentRef,
  DestroyRef,
  Directive,
  EnvironmentInjector,
  InjectionToken,
  Injector,
  OnDestroy,
  OnInit,
  booleanAttribute,
  createComponent,
  effect,
  inject,
  input,
  inputBinding,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { injectHostElement } from '@ethlete/core';
import { filter, take, tap } from 'rxjs';
import { STREAM_CONSENT_TOKEN, STREAM_USER_CONSENT_PROVIDER_TOKEN } from '../../consent/stream-consent.directive';
import { injectPipManager } from '../../pip-manager';
import { injectStreamConfig } from '../../stream-config';
import { injectStreamManager } from '../../stream-manager';
import { STREAM_SLOT_PLAYER_ID_TOKEN, StreamPlayerId } from '../../stream-manager.types';
import { STREAM_PLAYER_TOKEN } from '../../stream-player';
import { YoutubePlayerParamsDirective } from './youtube-player-params.directive';
import { YoutubePlayerComponent } from './youtube-player.component';

export const YOUTUBE_PLAYER_SLOT_TOKEN = new InjectionToken<YoutubePlayerSlotDirective>('YOUTUBE_PLAYER_SLOT_TOKEN');

@Directive({
  providers: [
    { provide: YOUTUBE_PLAYER_SLOT_TOKEN, useExisting: YoutubePlayerSlotDirective },
    {
      provide: STREAM_SLOT_PLAYER_ID_TOKEN,
      useFactory: () => inject(YoutubePlayerSlotDirective).currentPlayerIdSignal,
    },
  ],
})
export class YoutubePlayerSlotDirective implements OnInit, OnDestroy {
  private streamManager = injectStreamManager();
  private pipManager = injectPipManager();
  private el = injectHostElement<HTMLElement>();
  private appRef = inject(ApplicationRef);
  private envInjector = inject(EnvironmentInjector);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  private params = inject(YoutubePlayerParamsDirective);
  private streamConfig = injectStreamConfig();
  private consentHandler = inject(STREAM_USER_CONSENT_PROVIDER_TOKEN, { optional: true });
  private consentComponentRef: ComponentRef<unknown> | null = null;
  private pipPlaceholderComponentRef: ComponentRef<unknown> | null = null;

  streamSlotPriority = input(false, { transform: booleanAttribute });
  streamSlotOnPipBack = input<() => void>();

  currentPlayerIdSignal = signal<StreamPlayerId | null>(null);

  constructor() {
    effect(() => {
      const newPlayerId: StreamPlayerId = `youtube-${this.params.videoId()}`;
      const oldPlayerId = this.currentPlayerIdSignal();

      if (!oldPlayerId || oldPlayerId === newPlayerId) return;

      this.streamManager.transferPlayer(oldPlayerId, newPlayerId);

      this.streamManager.unregisterSlot(this.el);
      this.streamManager.registerSlot({
        playerId: newPlayerId,
        priority: this.streamSlotPriority(),
        element: this.el,
        onPipBack: this.streamSlotOnPipBack(),
      });

      this.currentPlayerIdSignal.set(newPlayerId);
    });
  }

  ngOnInit(): void {
    const videoId = this.params.videoId();
    this.currentPlayerIdSignal.set(`youtube-${videoId}`);
    const currentPlayerId = this.currentPlayerIdSignal()!;

    if (this.streamManager.getPlayerElement(currentPlayerId)) {
      this.streamManager.registerSlot({
        playerId: currentPlayerId,
        priority: this.streamSlotPriority(),
        element: this.el,
        onPipBack: this.streamSlotOnPipBack(),
      });
      return;
    }

    const { consentHandler } = this;
    const { consentComponent } = this.streamConfig;

    if (consentHandler?.isGranted()) {
      this.createAndRegisterPlayer(currentPlayerId);
      return;
    }

    if (!consentHandler && !consentComponent) {
      this.createAndRegisterPlayer(currentPlayerId);
      return;
    }

    if (consentHandler && !consentComponent) {
      toObservable(consentHandler.isGranted, { injector: this.envInjector })
        .pipe(
          filter(Boolean),
          take(1),
          tap(() => this.createAndRegisterPlayer(currentPlayerId)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe();
      return;
    }

    if (!consentComponent) {
      return;
    }

    const consentRef = createComponent(consentComponent, {
      environmentInjector: this.envInjector,
      elementInjector: this.injector,
    });
    this.appRef.attachView(consentRef.hostView);
    this.el.appendChild(consentRef.location.nativeElement);
    this.consentComponentRef = consentRef;

    const consentDirective = consentRef.injector.get(STREAM_CONSENT_TOKEN, null);

    if (!consentDirective) {
      if (ngDevMode) {
        console.warn(
          '[YoutubePlayerSlotDirective] consentComponent does not provide STREAM_CONSENT_TOKEN. ' +
            'Skipping consent gate. Ensure the component has hostDirectives: [StreamConsentDirective].',
        );
      }
      this.appRef.detachView(consentRef.hostView);
      consentRef.destroy();
      this.consentComponentRef = null;
      this.createAndRegisterPlayer(currentPlayerId);
    } else {
      toObservable(consentDirective.isGranted, { injector: this.envInjector })
        .pipe(
          filter(Boolean),
          take(1),
          tap(() => {
            this.appRef.detachView(consentRef.hostView);
            consentRef.destroy();
            this.consentComponentRef = null;
            this.createAndRegisterPlayer(currentPlayerId);
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe();
    }
  }

  ngOnDestroy(): void {
    if (this.currentPlayerIdSignal()) {
      this.streamManager.unregisterSlot(this.el);
    }

    if (this.consentComponentRef) {
      this.appRef.detachView(this.consentComponentRef.hostView);
      this.consentComponentRef.destroy();
      this.consentComponentRef = null;
    }

    if (this.pipPlaceholderComponentRef) {
      this.appRef.detachView(this.pipPlaceholderComponentRef.hostView);
      this.pipPlaceholderComponentRef.destroy();
      this.pipPlaceholderComponentRef = null;
    }
  }

  pipActivate(onBack?: () => void): void {
    this.pipManager.pipActivate(this.el, onBack);
  }

  pipDeactivate(): void {
    if (this.currentPlayerIdSignal()) {
      this.pipManager.pipDeactivate(this.currentPlayerIdSignal()!);
    }
  }

  private createAndRegisterPlayer(currentPlayerId: StreamPlayerId) {
    const componentRef = createComponent(YoutubePlayerComponent, {
      environmentInjector: this.envInjector,
      bindings: [
        inputBinding('videoId', () => this.params.videoId()),
        inputBinding('startTime', () => this.params.startTime()),
        inputBinding('width', () => this.params.width()),
        inputBinding('height', () => this.params.height()),
      ],
    });
    this.appRef.attachView(componentRef.hostView);

    const playerElement = componentRef.location.nativeElement as HTMLElement;

    this.streamManager.registerPlayer({
      id: currentPlayerId,
      element: playerElement,
      thumbnail: componentRef.injector.get(STREAM_PLAYER_TOKEN).thumbnail,
      onDestroy: () => {
        this.appRef.detachView(componentRef.hostView);
        componentRef.destroy();
      },
    });
    this.streamManager.registerSlot({
      playerId: currentPlayerId,
      priority: this.streamSlotPriority(),
      element: this.el,
      onPipBack: this.streamSlotOnPipBack(),
    });

    const { pipSlotPlaceholderComponent } = this.streamConfig;

    if (pipSlotPlaceholderComponent) {
      const placeholderRef = createComponent(pipSlotPlaceholderComponent, {
        environmentInjector: this.envInjector,
        elementInjector: this.injector,
      });
      this.appRef.attachView(placeholderRef.hostView);
      this.el.appendChild(placeholderRef.location.nativeElement);
      this.pipPlaceholderComponentRef = placeholderRef;
    }
  }
}
