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
} from '@angular/core';
import { injectHostElement } from '@ethlete/core';
import { injectStreamManager } from '../../stream-manager';
import { StreamPlayerId } from '../../stream-manager.types';
import { YoutubePlayerParamsDirective } from './youtube-player-params.directive';
import { YoutubePlayerComponent } from './youtube-player.component';

export const YOUTUBE_PLAYER_SLOT_TOKEN = new InjectionToken<YoutubePlayerSlotDirective>('YOUTUBE_PLAYER_SLOT_TOKEN');

@Directive({
  providers: [{ provide: YOUTUBE_PLAYER_SLOT_TOKEN, useExisting: YoutubePlayerSlotDirective }],
})
export class YoutubePlayerSlotDirective implements OnInit, OnDestroy {
  private manager = injectStreamManager();
  private el = injectHostElement<HTMLElement>();
  private appRef = inject(ApplicationRef);
  private envInjector = inject(EnvironmentInjector);
  private params = inject(YoutubePlayerParamsDirective);

  streamSlotPriority = input(false, { transform: booleanAttribute });
  streamSlotOnPipBack = input<() => void>();

  private currentPlayerId: StreamPlayerId | null = null;

  constructor() {
    effect(() => {
      const newPlayerId: StreamPlayerId = `youtube-${this.params.videoId()}`;
      const oldPlayerId = this.currentPlayerId;

      if (!oldPlayerId || oldPlayerId === newPlayerId) return;

      this.manager.transferPlayer(oldPlayerId, newPlayerId);

      this.manager.unregisterSlot(this.el);
      this.manager.registerSlot({
        playerId: newPlayerId,
        priority: this.streamSlotPriority(),
        element: this.el,
        onPipBack: this.streamSlotOnPipBack(),
      });

      this.currentPlayerId = newPlayerId;
    });
  }

  ngOnInit(): void {
    const videoId = this.params.videoId();
    this.currentPlayerId = `youtube-${videoId}`;

    if (this.manager.getPlayerElement(this.currentPlayerId)) {
      this.manager.registerSlot({
        playerId: this.currentPlayerId,
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

    this.manager.registerPlayer({
      id: this.currentPlayerId,
      element: playerElement,
      onDestroy: () => {
        this.appRef.detachView(componentRef.hostView);
        componentRef.destroy();
      },
    });
    this.manager.registerSlot({
      playerId: this.currentPlayerId,
      priority: this.streamSlotPriority(),
      element: this.el,
      onPipBack: this.streamSlotOnPipBack(),
    });
  }

  ngOnDestroy(): void {
    if (this.currentPlayerId) {
      this.manager.unregisterSlot(this.el);
    }
  }

  pipActivate(onBack?: () => void): void {
    this.manager.pipActivate(this.el, onBack);
  }

  pipDeactivate(): void {
    if (this.currentPlayerId) {
      this.manager.pipDeactivate(this.currentPlayerId);
    }
  }
}
