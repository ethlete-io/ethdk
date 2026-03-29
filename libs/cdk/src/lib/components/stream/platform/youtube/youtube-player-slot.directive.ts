import {
  ApplicationRef,
  Directive,
  EnvironmentInjector,
  InjectionToken,
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
import { injectHostElement } from '@ethlete/core';
import { injectPipManager } from '../../pip-manager';
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
  private params = inject(YoutubePlayerParamsDirective);

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
  }

  ngOnDestroy(): void {
    if (this.currentPlayerIdSignal()) {
      this.streamManager.unregisterSlot(this.el);
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
}
