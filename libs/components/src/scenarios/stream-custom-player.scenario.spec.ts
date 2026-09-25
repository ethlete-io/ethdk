import {
  booleanAttribute,
  Component,
  computed,
  createComponent,
  Directive,
  inject,
  Injectable,
  input,
  inputBinding,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  createStreamPlayerSlot,
  DEFAULT_STREAM_PLAYER_STATE,
  injectStreamManager,
  provideStreamConfig,
  STREAM_PLAYER_COMPONENT_TOKEN,
  STREAM_PLAYER_ERROR_CONTEXT_TOKEN,
  STREAM_PLAYER_ERROR_TOKEN,
  STREAM_PLAYER_PARAMS_TOKEN,
  STREAM_PLAYER_SLOT_TOKEN,
  STREAM_PLAYER_TOKEN,
  STREAM_SLOT_PLAYER_ID_TOKEN,
  StreamPlayer,
  StreamPlayerErrorDirective,
  StreamPlayerParams,
  StreamPlayerSlotDirective,
  StreamPlayerState,
} from '../index';
import { useScenario } from './harness';

@Injectable({ providedIn: 'root' })
class ArenaSdk {
  players: ArenaPlayerComponent[] = [];
}

@Directive({
  providers: [{ provide: STREAM_PLAYER_PARAMS_TOKEN, useExisting: ArenaParamsDirective }],
})
class ArenaParamsDirective implements StreamPlayerParams {
  matchId = input.required<string>();
  readonly ASPECT_RATIO = 4 / 3;
  playerId = computed(() => `arena-${this.matchId()}`);

  createBindings() {
    return [inputBinding('matchId', () => this.matchId())];
  }
}

@Component({
  selector: 'et-scenario-arena-player',
  template: '',
  hostDirectives: [{ directive: ArenaParamsDirective, inputs: ['matchId'] }],
  providers: [{ provide: STREAM_PLAYER_TOKEN, useExisting: ArenaPlayerComponent }],
})
class ArenaPlayerComponent implements StreamPlayer {
  params = inject(ArenaParamsDirective);
  calls: string[] = [];

  readonly CAPABILITIES = {
    canPlay: true,
    canPause: true,
    canMute: false,
    canSeek: false,
    canGetDuration: false,
    isLiveCapable: true,
    hasThumbnail: true,
  };

  state = signal<StreamPlayerState>(DEFAULT_STREAM_PLAYER_STATE);
  thumbnail = computed(() => `https://cdn.example.com/arena/${this.params.matchId()}.jpg`);

  constructor() {
    inject(ArenaSdk).players.push(this);
  }

  play = () => void this.calls.push('play');
  pause = () => void this.calls.push('pause');
  mute = () => undefined;
  unmute = () => undefined;
  seek = () => undefined;

  retry() {
    this.calls.push('retry');
    this.state.set(DEFAULT_STREAM_PLAYER_STATE);
  }

  report(patch: Partial<StreamPlayerState>) {
    this.state.update((current) => ({ ...current, ...patch }));
  }
}

@Component({
  selector: 'et-scenario-arena-slot',
  template: '<ng-content />',
  providers: [{ provide: STREAM_PLAYER_COMPONENT_TOKEN, useValue: ArenaPlayerComponent }],
  hostDirectives: [
    { directive: ArenaParamsDirective, inputs: ['matchId'] },
    { directive: StreamPlayerSlotDirective, inputs: ['streamSlotPriority'] },
  ],
})
class ArenaSlotComponent {
  slotDirective = inject(STREAM_PLAYER_SLOT_TOKEN);
  playerId = inject(STREAM_SLOT_PLAYER_ID_TOKEN);
}

@Directive({
  selector: '[etScenarioArenaFrame]',
  hostDirectives: [{ directive: ArenaParamsDirective, inputs: ['matchId'] }],
})
class ArenaFrameDirective {
  private params = inject(ArenaParamsDirective);

  pinned = input(false, { transform: booleanAttribute });

  slot = createStreamPlayerSlot({
    playerId: this.params.playerId,
    aspectRatio: this.params.ASPECT_RATIO,
    streamSlotPriority: this.pinned,
    streamSlotOnPipBack: signal(undefined),
    createPlayer: (environmentInjector, elementInjector) =>
      createComponent(ArenaPlayerComponent, {
        environmentInjector,
        elementInjector,
        bindings: this.params.createBindings(),
      }),
    directiveName: 'ArenaFrameDirective',
  });
}

@Component({
  selector: 'et-scenario-arena-loading',
  template: 'Warming up',
})
class ArenaLoadingComponent {}

@Component({
  selector: 'et-scenario-arena-error',
  hostDirectives: [StreamPlayerErrorDirective],
  template: `
    <p class="reason">{{ reason() }}</p>
    <button (click)="directive.context.retry()" class="again" type="button">Try again</button>
  `,
})
class ArenaErrorComponent {
  directive = inject(STREAM_PLAYER_ERROR_TOKEN);
  context = inject(STREAM_PLAYER_ERROR_CONTEXT_TOKEN);
  reason = computed(() => String(this.context.error()));
}

@Component({
  selector: 'et-scenario-arena-page',
  imports: [ArenaSlotComponent],
  template: `<et-scenario-arena-slot [matchId]="matchId()" />`,
})
class ArenaPageComponent {
  matchId = signal('final');
  slot = viewChild.required(ArenaSlotComponent);
}

@Component({
  selector: 'et-scenario-arena-wall',
  imports: [ArenaFrameDirective],
  template: `
    <div class="small" etScenarioArenaFrame matchId="final"></div>
    @if (pinned()) {
      <div class="large" etScenarioArenaFrame matchId="final" pinned></div>
    }
  `,
})
class ArenaWallComponent {
  pinned = signal(false);
  frames = viewChildren(ArenaFrameDirective);
}

const query = (selector: string, root: ParentNode) => {
  const element = root.querySelector<HTMLElement>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

describe('stream custom player scenarios', () => {
  const scenario = useScenario({
    providers: [provideStreamConfig({ loadingComponent: ArenaLoadingComponent, errorComponent: ArenaErrorComponent })],
  });

  it('plugs an app-defined platform into a stream slot with its own loading and error chrome', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ArenaPageComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    const slotHost = query('et-scenario-arena-slot', host);
    const [player] = TestBed.inject(ArenaSdk).players;
    const slot = fixture.componentInstance.slot();

    if (!player) throw new Error('no arena player');

    expect(slot.slotDirective).toBeInstanceOf(StreamPlayerSlotDirective);
    expect(slot.playerId()).toBe('arena-final');
    expect(player.params.matchId()).toBe('final');
    expect(query('et-scenario-arena-player', slotHost)).toBeTruthy();
    expect(query('et-scenario-arena-loading', slotHost).textContent).toBe('Warming up');

    player.report({ isReady: true, isLoading: false });
    s.flush();

    expect(slotHost.querySelector('et-scenario-arena-loading')).toBeNull();
    expect(slot.slotDirective.slot.currentState().isReady).toBe(true);

    player.report({ error: 'geo-blocked' });
    s.flush();

    expect(query('.reason', slotHost).textContent).toBe('geo-blocked');

    query('.again', slotHost).click();
    s.flush();

    expect(player.calls).toEqual(['retry']);
    expect(slotHost.querySelector('et-scenario-arena-error')).toBeNull();
    expect(slotHost.querySelector('et-scenario-arena-loading')).not.toBeNull();

    fixture.componentInstance.matchId.set('replay');
    s.flush();

    expect(slot.playerId()).toBe('arena-replay');
    expect(
      s
        .run(() => injectStreamManager())
        .getPlayerEntry('arena-replay')
        ?.thumbnail?.(),
    ).toBe('https://cdn.example.com/arena/replay.jpg');
  });

  it('builds a slot directive of its own on createStreamPlayerSlot and hands one player between frames', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ArenaWallComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    const small = query('.small', host);
    const playerEl = query('et-scenario-arena-player', small);

    fixture.componentInstance.pinned.set(true);
    s.flush();

    const large = query('.large', host);

    expect(playerEl.parentElement).toBe(large);
    expect(TestBed.inject(ArenaSdk).players).toHaveLength(1);
    expect(fixture.componentInstance.frames().map((frame) => frame.slot.currentPlayerIdSignal())).toEqual([
      'arena-final',
      'arena-final',
    ]);

    fixture.componentInstance.pinned.set(false);
    s.flush();

    expect(playerEl.parentElement).toBe(small);
  });
});
