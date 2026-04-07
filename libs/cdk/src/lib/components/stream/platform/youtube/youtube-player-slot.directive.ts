import {
  Directive,
  InjectionToken,
  booleanAttribute,
  computed,
  createComponent,
  inject,
  input,
  inputBinding,
} from '@angular/core';
import { STREAM_SLOT_PLAYER_ID_TOKEN } from '../../stream-manager.types';
import { createStreamPlayerSlot } from '../../stream-player-slot';
import { YoutubePlayerParamsDirective } from './youtube-player-params.directive';
import { YoutubePlayerComponent } from './youtube-player.component';

export const YOUTUBE_PLAYER_SLOT_TOKEN = new InjectionToken<YoutubePlayerSlotDirective>('YOUTUBE_PLAYER_SLOT_TOKEN');

@Directive({
  providers: [
    { provide: YOUTUBE_PLAYER_SLOT_TOKEN, useExisting: YoutubePlayerSlotDirective },
    {
      provide: STREAM_SLOT_PLAYER_ID_TOKEN,
      useFactory: () => inject(YoutubePlayerSlotDirective).slot.currentPlayerIdSignal,
    },
  ],
})
export class YoutubePlayerSlotDirective {
  private params = inject(YoutubePlayerParamsDirective);

  streamSlotPriority = input(false, { transform: booleanAttribute });
  streamSlotOnPipBack = input<() => void>();

  slot = createStreamPlayerSlot({
    playerId: computed(() => `youtube-${this.params.videoId()}`),
    aspectRatio: 16 / 9,
    streamSlotPriority: this.streamSlotPriority,
    streamSlotOnPipBack: this.streamSlotOnPipBack,
    createPlayer: (envInjector, elementInjector) =>
      createComponent(YoutubePlayerComponent, {
        environmentInjector: envInjector,
        elementInjector,
        bindings: [
          inputBinding('videoId', () => this.params.videoId()),
          inputBinding('startTime', () => this.params.startTime()),
          inputBinding('width', () => this.params.width()),
          inputBinding('height', () => this.params.height()),
        ],
      }),
    directiveName: 'YoutubePlayerSlotDirective',
  });
}
