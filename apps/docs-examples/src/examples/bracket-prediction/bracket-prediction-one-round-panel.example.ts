import {
  Component,
  computed,
  forwardRef,
  inject,
  InjectionToken,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {
  BRACKET_IMPORTS,
  BracketDefaultRoundHeaderComponent,
  BracketLayoutConfig,
  BracketMatch,
  BracketRound,
  BracketRoundSwissGroup,
  BUTTON_IMPORTS,
  CHEVRON_ICON,
  createBracket,
  ICON_IMPORTS,
  MatchParticipantSide,
  NormalizedMatchParticipant,
  provideBracketConfig,
  provideIcons,
  resolveBracketLayoutSettings,
  resolveBracketSlot,
  singleEliminationBracketLayout,
} from '@ethlete/components';
import { PANEL_PARTICIPANTS, PANEL_SOURCE } from './bracket-prediction-one-round-panel.data';

type PickWriter = { pick: (matchId: string, participantId: string) => void };

const PICK_WRITER = new InjectionToken<PickWriter>('PICK_WRITER');

const LAYOUT: BracketLayoutConfig = {
  columnWidth: 220,
  finalColumnWidth: 220,
  matchHeight: 88,
  finalMatchHeight: 88,
  focusInset: 44,
};

@Component({
  selector: 'app-pick-match-card',
  template: `
    @for (participant of [home(), away()]; track $index) {
      <button
        [disabled]="!participant"
        [attr.aria-pressed]="!!participant && participant.id === pickedId()"
        (click)="participant && writer.pick(bracketMatch().id, participant.id)"
        class="app-pick-match-card__side"
        type="button"
      >
        {{ participant?.name ?? 'Pick the round before' }}
      </button>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-pick-match-card' },
  styles: `
    .app-pick-match-card {
      display: grid;
      gap: 4px;
      block-size: 100%;
    }

    .app-pick-match-card__side {
      padding-inline: 12px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 8px;
      background: var(--et-surface-background-solid);
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;

      &[aria-pressed='true'] {
        border-color: var(--et-theme-color-primary-solid);
        background: var(--et-theme-color-primary-solid);
        color: var(--et-theme-color-on-primary-solid);
      }

      &:disabled {
        cursor: default;
        opacity: 0.6;
      }
    }
  `,
})
export class PickMatchCardComponent {
  protected writer = inject(PICK_WRITER);

  public bracketRound = input.required<BracketRound<null, null>>();
  public bracketMatch = input.required<BracketMatch<null, null>>();
  public bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<null, null> | null>();

  public home = input<NormalizedMatchParticipant | null>(null);
  public away = input<NormalizedMatchParticipant | null>(null);
  public pickedId = input<string | null>(null);
}

@Component({
  selector: 'app-bracket-prediction-one-round-panel-example',
  template: `
    <p aria-live="polite">{{ focusedRound()?.name }}</p>

    <div [style.inline-size.px]="panelWidth" class="app-round-panel">
      <et-bracket
        [source]="SOURCE"
        [matchComponent]="CARD"
        [finalMatchComponent]="CARD"
        [matchInputs]="matchInputs"
        [focusRoundId]="focusedRound()?.id ?? null"
        [rowSpanRoundId]="focusedRound()?.id ?? null"
        disableJourneyHighlight
      />

      <button
        [disabled]="focusedIndex() === 0"
        (click)="step(-1)"
        class="app-round-panel__chevron app-round-panel__chevron--previous"
        et-icon-button
        type="button"
        aria-label="Previous round"
      >
        <i etIcon="et-chevron"></i>
      </button>

      <button
        [disabled]="focusedIndex() === ROUNDS.length - 1"
        (click)="step(1)"
        class="app-round-panel__chevron app-round-panel__chevron--next"
        et-icon-button
        type="button"
        aria-label="Next round"
      >
        <i etIcon="et-chevron"></i>
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BRACKET_IMPORTS, BUTTON_IMPORTS, ICON_IMPORTS],
  providers: [
    provideBracketConfig({
      ...LAYOUT,
      layouts: [singleEliminationBracketLayout()],
      roundHeaderComponent: BracketDefaultRoundHeaderComponent,
    }),
    provideIcons(CHEVRON_ICON),
    { provide: PICK_WRITER, useExisting: forwardRef(() => BracketPredictionOneRoundPanelExampleComponent) },
  ],
  styles: `
    .app-round-panel {
      position: relative;
      overflow: clip;
    }

    .app-round-panel__chevron {
      position: absolute;
      inset-block-start: 0;

      &.app-round-panel__chevron--previous {
        inset-inline-start: 0;
        rotate: -90deg;
      }

      &.app-round-panel__chevron--next {
        inset-inline-end: 0;
        rotate: 90deg;
      }
    }
  `,
})
export class BracketPredictionOneRoundPanelExampleComponent implements PickWriter {
  private winners = signal<Record<string, string>>({});
  private bracket = createBracket(PANEL_SOURCE, { layout: 'left-to-right' });
  private settings = resolveBracketLayoutSettings(LAYOUT);

  protected readonly SOURCE = PANEL_SOURCE;
  protected readonly CARD = PickMatchCardComponent;
  protected readonly ROUNDS = PANEL_SOURCE.rounds;
  protected panelWidth = this.settings.focusInset + this.settings.columnWidth + this.settings.focusInset;

  protected focusedIndex = signal(0);
  protected focusedRound = computed(() => this.ROUNDS[this.focusedIndex()] ?? null);

  protected readonly matchInputs = this.inputsFor.bind(this);

  public pick(matchId: string, participantId: string) {
    this.winners.update((current) => ({ ...current, [matchId]: participantId }));
  }

  public inputsFor(match: BracketMatch<null, null>) {
    return {
      home: this.resolveParticipant(match, 'home'),
      away: this.resolveParticipant(match, 'away'),
      pickedId: this.winners()[match.id] ?? null,
    };
  }

  protected step(direction: -1 | 1) {
    this.focusedIndex.update((index) => Math.min(Math.max(index + direction, 0), this.ROUNDS.length - 1));
  }

  private resolveParticipant(match: BracketMatch<null, null>, side: MatchParticipantSide) {
    const participantId = resolveBracketSlot({
      bracket: this.bracket,
      picks: {
        matchWinner: (matchId) => this.winners()[matchId] ?? null,
        standingRank: () => null,
      },
      matchId: match.id,
      side,
    });

    return participantId ? (PANEL_PARTICIPANTS[participantId] ?? null) : null;
  }
}
