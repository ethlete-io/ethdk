import {
  Binding,
  Directive,
  InjectionToken,
  Signal,
  Type,
  booleanAttribute,
  computed,
  createComponent,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import {
  ProvideSurfaceDirective,
  SURFACE_PROVIDER,
  injectStyleManager,
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
  private parentSurfaceProvider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });

  public streamSlotPriority = input(false, { transform: booleanAttribute });
  public streamSlotOnPipBack = input<() => void>();
  private surfaceThemes = injectSurfaceThemes({ optional: true });
  private styleManager = injectStyleManager();

  private resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;
    if (!themes) return null;

    const type = this.parentSurfaceProvider?.surfaceType() ?? 'dark';
    const elevation = (this.parentSurfaceProvider?.elevation() ?? 0) + 1;
    return resolveSurfaceByElevation(themes, type, elevation);
  });

  public slot = createStreamPlayerSlot({
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

    if (this.surfaceThemes) {
      effect(() => {
        const surface = this.resolvedSurface();

        untracked(() => {
          setInputSignal(this.provideSurface.surface, surface?.name ?? null);
        });
      });
    }
  }
}
