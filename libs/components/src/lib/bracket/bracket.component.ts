import { NgComponentOutlet } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  NgZone,
  numberAttribute,
  signal,
  Type,
  ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { createComponentId, injectRenderer } from '@ethlete/core';
import { BracketDataLayout, TOURNAMENT_MODE } from './core';
import { drawMan, drawSwissMan } from './drawing';
import {
  BracketContinueComponent,
  BracketMatchComponent,
  BracketRoundHeaderComponent,
  FinalizedBracketElement,
} from './drawing/grid';
import { BracketDataSource } from './integrations';
import {
  createBracketJourneyParticipants,
  JourneyHighlightController,
  setupJourneyHighlight as setupJourneyHighlightListeners,
} from './journey-highlight';
import { createBracket, generateBracketRoundSwissGroupMaps } from './linked';
import { BRACKET_CARD_CONTEXT, BracketMatchNormalizer } from './bracket-card-context';
import { resolveBracketComponents } from './bracket-components';
import { BracketDensity } from './bracket-density';
import { computeBracketGrid, createBracketGridConfig, resolveBracketLayoutSettings } from './bracket-grid';
import {
  OptionalBooleanInput,
  optionalBooleanAttribute,
  OptionalNumberInput,
  optionalNumberAttribute,
} from './bracket-input-transforms';
import { BRACKET_DEFAULTS, BracketSwissColors, injectBracketConfig } from './bracket.config';

@Component({
  selector: 'et-bracket',
  templateUrl: './bracket.component.html',
  styleUrl: './bracket.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgComponentOutlet],
  // What the default cards read: this component resolves each value from its own input first and the
  // app-wide config second, so a card never has to know where a setting came from.
  providers: [{ provide: BRACKET_CARD_CONTEXT, useExisting: BracketComponent }],
  host: {
    class: 'et-bracket-host',
  },
})
export class BracketComponent<TRoundData = unknown, TMatchData = unknown> {
  private domSanitizer = inject(DomSanitizer);
  private config = injectBracketConfig();

  public source = input.required<BracketDataSource<TRoundData, TMatchData>>();

  // Every layout input is an *override*, left `undefined` when unbound: what draws is resolved in
  // `settings`, where an unset input falls through to the density preset and then to the shipped
  // default. Binding `undefined` deliberately is therefore the same as not binding at all.
  public columnWidth = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public matchHeight = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public finalMatchHeight = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public finalColumnWidth = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public roundHeaderHeight = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public roundHeaderGap = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public columnGap = input<number | undefined, OptionalNumberInput>(undefined, { transform: optionalNumberAttribute });
  public rowGap = input<number | undefined, OptionalNumberInput>(undefined, { transform: optionalNumberAttribute });
  public rowRoundGap = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public lineStartingCurveAmount = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public lineEndingCurveAmount = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public lineWidth = input<number | undefined, OptionalNumberInput>(undefined, { transform: optionalNumberAttribute });
  public lineDashArray = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public lineDashOffset = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public disableJourneyHighlight = input<boolean | undefined, OptionalBooleanInput>(undefined, {
    transform: optionalBooleanAttribute,
  });
  public swissGroupPadding = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public swissGroupBorderRadius = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public swissColors = input<BracketSwissColors | undefined>(this.config.swiss?.colors);

  public layout = input<BracketDataLayout | undefined>(undefined);

  /**
   * The size everything is drawn at. `'compact'` is roughly two thirds of the default — a column narrow
   * enough that the cards inside it drop to codes and a score, which is what fits a full bracket into an
   * article column. Anything you set yourself still wins over it.
   */
  public density = input<BracketDensity | undefined>(undefined);

  public hideRoundHeaders = input<boolean | undefined, OptionalBooleanInput>(undefined, {
    transform: optionalBooleanAttribute,
  });

  public showContinueElement = input<boolean | undefined, OptionalBooleanInput>(undefined, {
    transform: optionalBooleanAttribute,
  });
  public continueColumnWidth = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public continueElementHeight = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });
  public continueLineDashArray = input<number | undefined, OptionalNumberInput>(undefined, {
    transform: optionalNumberAttribute,
  });

  public roundHeaderComponent = input<BracketRoundHeaderComponent<TRoundData, TMatchData> | undefined>();
  public matchComponent = input<BracketMatchComponent<TRoundData, TMatchData> | undefined>();
  public finalMatchComponent = input<BracketMatchComponent<TRoundData, TMatchData> | undefined>();
  public continueComponent = input<BracketContinueComponent<TRoundData, TMatchData> | undefined>();

  /**
   * How to read your match data, for the **default** cards — see {@link BracketMatchNormalizer}. Cards of
   * your own get the match through their inputs and need none of this.
   */
  public matchNormalizer = input<BracketMatchNormalizer<TRoundData, TMatchData> | undefined>();

  /** The `aria-level` the default round headers announce themselves at. @default 3 */
  public roundHeaderLevel = input(this.config.roundHeaderLevel ?? BRACKET_DEFAULTS.roundHeaderLevel, {
    transform: numberAttribute,
  });

  /**
   * The participant whose journey stays lit, by their id in the source — the pinned counterpart to the
   * hover highlight, and the only one touch and keyboard users get.
   *
   * Two-way, and **driven from outside**: a participants list beside the bracket, a query param, a
   * search box. The bracket never pins on a card tap — a card's click belongs to the card — but it does
   * drop the pin when <kbd>Escape</kbd> is pressed inside it or a click lands past the cells, and writes
   * the `null` back through this model.
   *
   * @example
   * <et-bracket [(focusedParticipantId)]="focusedTeamId" [source]="source()" />
   */
  public focusedParticipantId = model<string | null>(null);

  /** @internal The normalizer in effect, read by the default cards through `BRACKET_CARD_CONTEXT`. */
  public resolvedMatchNormalizer = computed<BracketMatchNormalizer | null>(
    () => this.matchNormalizer() ?? this.config.matchNormalizer ?? null,
  );

  /** @internal The heading level in effect, read by the default round headers. */
  public resolvedRoundHeaderLevel = computed(() => this.roundHeaderLevel());

  private elementId = createComponentId('et-bracket');

  private journeyController = signal<JourneyHighlightController | null>(null);

  /**
   * Every layout value in effect: this component's inputs first, `provideBracketConfig` second, the
   * density preset third, the shipped defaults last. Read this rather than the inputs — an input alone
   * is only half the answer.
   */
  public settings = computed(() =>
    resolveBracketLayoutSettings({
      ...this.config,
      density: this.density() ?? this.config.density,
      columnWidth: this.columnWidth() ?? this.config.columnWidth,
      matchHeight: this.matchHeight() ?? this.config.matchHeight,
      finalMatchHeight: this.finalMatchHeight() ?? this.config.finalMatchHeight,
      finalColumnWidth: this.finalColumnWidth() ?? this.config.finalColumnWidth,
      roundHeaderHeight: this.roundHeaderHeight() ?? this.config.roundHeaderHeight,
      roundHeaderGap: this.roundHeaderGap() ?? this.config.roundHeaderGap,
      columnGap: this.columnGap() ?? this.config.columnGap,
      rowGap: this.rowGap() ?? this.config.rowGap,
      rowRoundGap: this.rowRoundGap() ?? this.config.rowRoundGap,
      lineStartingCurveAmount: this.lineStartingCurveAmount() ?? this.config.lineStartingCurveAmount,
      lineEndingCurveAmount: this.lineEndingCurveAmount() ?? this.config.lineEndingCurveAmount,
      lineWidth: this.lineWidth() ?? this.config.lineWidth,
      lineDashArray: this.lineDashArray() ?? this.config.lineDashArray,
      lineDashOffset: this.lineDashOffset() ?? this.config.lineDashOffset,
      disableJourneyHighlight: this.disableJourneyHighlight() ?? this.config.disableJourneyHighlight,
      swissGroupPadding: this.swissGroupPadding() ?? this.config.swissGroupPadding,
      swissGroupBorderRadius: this.swissGroupBorderRadius() ?? this.config.swissGroupBorderRadius,
      layout: this.layout() ?? this.config.layout,
      hideRoundHeaders: this.hideRoundHeaders() ?? this.config.hideRoundHeaders,
      showContinueElement: this.showContinueElement() ?? this.config.showContinueElement,
      continueColumnWidth: this.continueColumnWidth() ?? this.config.continueColumnWidth,
      continueElementHeight: this.continueElementHeight() ?? this.config.continueElementHeight,
      continueLineDashArray: this.continueLineDashArray() ?? this.config.continueLineDashArray,
      roundHeaderLevel: this.roundHeaderLevel(),
    }),
  );

  public bracketData = computed(() => createBracket(this.source(), { layout: this.settings().layout }));

  public swissGroups = computed(() => generateBracketRoundSwissGroupMaps(this.bracketData()));

  private journeyParticipants = computed(() => createBracketJourneyParticipants(this.bracketData()));

  public bracketGrid = computed(() => {
    const bracketData = this.bracketData();
    const options = createBracketGridConfig(this.settings());

    const components = resolveBracketComponents(
      {
        roundHeader: this.roundHeaderComponent(),
        match: this.matchComponent(),
        finalMatch: this.finalMatchComponent(),
        continue: this.continueComponent(),
      },
      this.config,
      bracketData.mode,
    );

    return computeBracketGrid(bracketData, options, components);
  });

  public drawManData = computed(() => {
    const bracketGrid = this.bracketGrid();

    if (!bracketGrid) return '';

    const settings = this.settings();

    if (this.bracketData().mode === TOURNAMENT_MODE.SWISS_WITH_ELIMINATION) {
      return drawSwissMan({
        bracketGrid,
        curve: {
          lineStartingCurveAmount: settings.lineStartingCurveAmount,
        },
        path: {
          dashArray: settings.lineDashArray,
          dashOffset: settings.lineDashOffset,
          width: settings.lineWidth,
        },
        groupBorder: {
          padding: settings.swissGroupPadding,
          radius: settings.swissGroupBorderRadius,
          width: settings.lineWidth,
        },
        colors: this.swissColors(),
        idPrefix: this.elementId,
      });
    }

    return drawMan({
      columnGap: settings.columnGap,
      upperLowerGap: settings.rowRoundGap,
      columnWidth: settings.columnWidth,
      matchHeight: settings.matchHeight,
      roundHeaderHeight: settings.hideRoundHeaders ? 0 : settings.roundHeaderHeight,
      rowGap: settings.rowGap,
      bracketGrid,
      curve: {
        lineEndingCurveAmount: settings.lineEndingCurveAmount,
        lineStartingCurveAmount: settings.lineStartingCurveAmount,
      },
      path: {
        dashArray: settings.lineDashArray,
        dashOffset: settings.lineDashOffset,
        width: settings.lineWidth,
      },
      continuePath: {
        dashArray: settings.continueLineDashArray,
        dashOffset: settings.lineDashOffset,
        width: settings.lineWidth,
      },
    });
  });

  public svgContent = computed(() => this.domSanitizer.bypassSecurityTrustHtml(this.drawManData()));

  constructor() {
    this.setupJourneyHighlight();
  }

  /**
   * Narrows a finalized element's component (a union of differently-shaped `Type`s) to the
   * `Type<unknown>` that `NgComponentOutlet` expects, keeping the cast out of the template.
   */
  protected componentFor(element: FinalizedBracketElement<TRoundData, TMatchData>): Type<unknown> {
    return element.component as Type<unknown>;
  }

  private setupJourneyHighlight() {
    const renderer = injectRenderer();
    const ngZone = inject(NgZone);
    const elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    const host = elementRef.nativeElement;

    effect((onCleanup) => {
      if (this.settings().disableJourneyHighlight) {
        this.journeyController.set(null);

        return;
      }

      const controller = ngZone.runOutsideAngular(() =>
        setupJourneyHighlightListeners({
          host,
          renderer,
          participants: this.journeyParticipants,
          // The bracket only ever *drops* the pin (Escape, a click past the cards), and does it from
          // outside Angular — so the write back into the model has to re-enter.
          onFocusChange: (participantId) => ngZone.run(() => this.focusedParticipantId.set(participantId)),
        }),
      );

      this.journeyController.set(controller);

      // via onCleanup, not a returned function: effect() ignores what the callback returns, so the
      // listeners would stack up on every re-run and outlive the component.
      onCleanup(() => controller.destroy());
    });

    // A signal rather than a local, so a controller rebuilt by the effect above re-applies the pin.
    effect(() => this.journeyController()?.setFocused(this.focusedParticipantId()));
  }
}
