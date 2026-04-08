import type { Binding } from '@angular/core';
import {
  Directive,
  InjectionToken,
  Signal,
  Type,
  booleanAttribute,
  createComponent,
  inject,
  input,
} from '@angular/core';
import { STREAM_SLOT_PLAYER_ID_TOKEN, StreamPlayerId } from './stream-manager.types';
import { createStreamPlayerSlot } from './stream-player-slot';

export type StreamPlayerParams = {
  readonly playerId: Signal<StreamPlayerId>;
  /** Natural aspect ratio (width / height) of the player. Defaults to 16/9 if absent. */
  readonly ASPECT_RATIO?: number;
  createBindings(): Binding[];
};

export const STREAM_PLAYER_PARAMS_TOKEN = new InjectionToken<StreamPlayerParams>('STREAM_PLAYER_PARAMS_TOKEN');
export const STREAM_PLAYER_COMPONENT_TOKEN = new InjectionToken<Type<unknown>>('STREAM_PLAYER_COMPONENT_TOKEN');
export const STREAM_PLAYER_SLOT_TOKEN = new InjectionToken<StreamPlayerSlotDirective>('STREAM_PLAYER_SLOT_TOKEN');

@Directive({
  providers: [
    { provide: STREAM_PLAYER_SLOT_TOKEN, useExisting: StreamPlayerSlotDirective },
    {
      provide: STREAM_SLOT_PLAYER_ID_TOKEN,
      useFactory: () => {
        const directive = inject(StreamPlayerSlotDirective);
        return directive.slot.currentPlayerIdSignal;
      },
    },
  ],
  host: { style: 'position: relative; display: block;' },
})
export class StreamPlayerSlotDirective {
  private params = inject(STREAM_PLAYER_PARAMS_TOKEN);
  private playerComponent = inject(STREAM_PLAYER_COMPONENT_TOKEN);

  streamSlotPriority = input(false, { transform: booleanAttribute });
  streamSlotOnPipBack = input<() => void>();

  slot = createStreamPlayerSlot({
    playerId: this.params.playerId,
    aspectRatio: this.params.ASPECT_RATIO ?? 16 / 9,
    streamSlotPriority: this.streamSlotPriority,
    streamSlotOnPipBack: this.streamSlotOnPipBack,
    createPlayer: (envInjector, elementInjector) =>
      createComponent(this.playerComponent, {
        environmentInjector: envInjector,
        elementInjector,
        bindings: this.params.createBindings(),
      }),
  });
}
