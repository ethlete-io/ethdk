import {
  Binding,
  DestroyRef,
  Directive,
  InjectionToken,
  Signal,
  Type,
  booleanAttribute,
  computed,
  createComponent,
  inject,
  input,
} from '@angular/core';
import {
  ProvideSurfaceDirective,
  SurfacedDirective,
  injectStyleManager,
  injectSurfaceContextTracker,
  injectSurfaceThemes,
  resolveSurfaceByElevation,
  setInputSignal,
} from '@ethlete/core';
import { STREAM_SLOT_PLAYER_ID_TOKEN, StreamPlayerId } from './stream-manager.types';
import { createStreamPlayerSlot } from './stream-player-slot';
import { StreamPlayerSlotStylesComponent } from './stream-player-slot-styles.component';

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
  hostDirectives: [
    SurfacedDirective,
    {
      directive: ProvideSurfaceDirective,
      inputs: ['etProvideSurface:surface'],
    },
  ],
  host: {
    class: 'et-stream-player-slot',
  },
})
export class StreamPlayerSlotDirective {
  private params = inject(STREAM_PLAYER_PARAMS_TOKEN);
  private playerComponent = inject(STREAM_PLAYER_COMPONENT_TOKEN);
  private provideSurface = inject(ProvideSurfaceDirective);
  private surfaceThemes = injectSurfaceThemes({ optional: true });
  private surfaceContextTracker = injectSurfaceContextTracker();
  private styleManager = injectStyleManager();
  private destroyRef = inject(DestroyRef);

  streamSlotPriority = input(false, { transform: booleanAttribute });
  streamSlotOnPipBack = input<() => void>();

  private resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;
    if (!themes) return null;

    const type = this.surfaceContextTracker.topType() ?? 'dark';
    const elevation = this.surfaceContextTracker.topElevation() + 1;
    return resolveSurfaceByElevation(themes, type, elevation);
  });

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

  constructor() {
    this.styleManager.mount(StreamPlayerSlotStylesComponent);

    const themes = this.surfaceThemes;

    if (themes) {
      const type = this.surfaceContextTracker.topType() ?? 'dark';
      const resolved = this.resolvedSurface();
      const elevation = (this.surfaceContextTracker.topElevation() ?? 0) + 1;

      if (resolved) {
        setInputSignal(this.provideSurface.surface, resolved.name);
      }

      const unregister = this.surfaceContextTracker.register(type, elevation, resolved?.neutralColor);
      this.destroyRef.onDestroy(unregister);
    }
  }
}
