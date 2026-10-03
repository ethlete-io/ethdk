import { NgComponentOutlet } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  NgZone,
  numberAttribute,
  Signal,
  signal,
  Type,
  ViewEncapsulation,
} from '@angular/core';
import { createComponentId, injectRenderer, injectStyleManager } from '@ethlete/core';
import {
  BracketContinueComponent,
  FinalizedBracketElement,
  BracketMatchComponent,
  BracketRoundHeaderComponent,
  createBracket,
  BracketSwissColors,
  CreateBracketOptions,
} from '@ethlete/bracket';
import { BracketDataSource } from './integrations';
import { MATCH_CARD_SIZES, MatchCardSize } from '../match';
import {
  createBracketJourneyParticipants,
  JourneyHighlightController,
  setupJourneyHighlight as setupJourneyHighlightListeners,
} from './journey-highlight';
import { BRACKET_CARD_CONTEXT, BracketMatchNormalizer } from './bracket-card-context';
import { resolveBracketComponents } from './bracket-components';
import { BracketDensity } from './bracket-density';
import { createBracketGridConfig, resolveBracketLayoutSettings } from './bracket-grid';
import {
  nullableNumberAttribute,
  OptionalBooleanInput,
  optionalBooleanAttribute,
  OptionalNumberInput,
  optionalNumberAttribute,
} from './bracket-input-transforms';
import { BracketLayout } from './bracket-layout';
import {
  bracketHostWarningHandler,
  warnUnknownBracketRoundIds,
  createBracketHostLayout,
  createBracketHostMatchNormalizer,
} from './bracket-host';
import { BRACKET_DEFAULTS, BracketRoundHeaderAlign, injectBracketConfig } from './bracket.config';

@Component({
  selector: 'et-bracket',
  templateUrl: './bracket.component.html',
  styleUrl: './bracket.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgComponentOutlet],
  providers: [{ provide: BRACKET_CARD_CONTEXT, useExisting: BracketComponent }],
  host: {
    class: 'et-bracket-host',
  },
})
export class BracketComponent<TRoundData = unknown, TMatchData = unknown> {
  private config = injectBracketConfig();

  public source = input.required<BracketDataSource<TRoundData, TMatchData>>();

  /**
   * The matches feeding each match, upper arm first - the same option `createBracket` takes. Pass the
   * function your own `createBracket` call uses, so the drawn lines and the resolved picks follow one graph.
   */
  public previousMatchIds = input<CreateBracketOptions<TMatchData>['previousMatchIds']>(undefined);

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
  public rowSpanRoundId = input<string | null | undefined>(undefined);
  public thirdPlaceTopOffset = input<number | null | undefined, OptionalNumberInput>(undefined, {
    transform: nullableNumberAttribute,
  });
  public finalRoundHeaderGap = input<number | null | undefined, OptionalNumberInput>(undefined, {
    transform: nullableNumberAttribute,
  });
  public alignRoundHeaders = input<BracketRoundHeaderAlign | undefined>(undefined);

  /** Move this round to the inline start without changing the bracket's vertical density. */
  public focusRoundId = input<string | null>(null);

  /**
   * Room kept to the inline start of `focusRoundId`, in px - the gutter a one-round panel puts its
   * navigation in, and that a card badge may straddle the card's edge into.
   */
  public focusInset = input<number | undefined, OptionalNumberInput>(undefined, {
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
  public swissColors = input<BracketSwissColors | undefined>(undefined);

  /**
   * The layouts this instance may draw with, replacing the `provideBracketConfig` list entirely -
   * see {@link BracketLayout}. The first entry whose `mode` matches the source draws it; a source
   * nothing matches throws `ET3413`.
   *
   * @example
   * <et-bracket [layouts]="layouts" [source]="source()" />
   */
  public layouts = input<readonly BracketLayout<TRoundData, TMatchData>[] | undefined>(undefined);

  /**
   * The size everything is drawn at. `'compact'` is roughly two thirds of the default - a column narrow
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
   * How to read your match data, for the **default** cards - see {@link BracketMatchNormalizer}. Cards of
   * your own get the match through their inputs and need none of this.
   */
  public matchNormalizer = input<BracketMatchNormalizer<TRoundData, TMatchData> | undefined>();

  /** The `aria-level` the default round headers announce themselves at. @default 3 */
  public roundHeaderLevel = input(this.config.roundHeaderLevel ?? BRACKET_DEFAULTS.roundHeaderLevel, {
    transform: numberAttribute,
  });

  /**
   * The participant whose journey stays lit, by their id in the source - the pinned counterpart to the
   * hover highlight, and the only one touch and keyboard users get.
   *
   * Two-way, and **driven from outside**: a participants list beside the bracket, a query param, a
   * search box. The bracket never pins on a card tap - a card's click belongs to the card - but it does
   * drop the pin when an unhandled <kbd>Escape</kbd> is pressed anywhere on the page or a click lands past the cells, and writes
   * the `null` back through this model.
   *
   * @example
   * <et-bracket [(focusedParticipantId)]="focusedTeamId" [source]="source()" />
   */
  public focusedParticipantId = model<string | null>(null);

  /** @internal The normalizer in effect, read by the default cards through `BRACKET_CARD_CONTEXT`. */
  public resolvedMatchNormalizer = createBracketHostMatchNormalizer(this.matchNormalizer, this.config);

  /** @internal The heading level in effect, read by the default round headers. */
  public resolvedRoundHeaderLevel: Signal<number> = this.roundHeaderLevel;

  /**
   * @internal Left to the card: a grid cell's width is this component's decision, and `finalColumnWidth`
   * is how a consumer asks for a smaller final.
   */
  public resolvedFinalMatchCardSize = computed<MatchCardSize>(() => MATCH_CARD_SIZES.AUTO);

  private elementId = createComponentId('et-bracket');

  private journeyController = signal<JourneyHighlightController | null>(null);

  /**
   * Every layout value in effect: this component's inputs first, `provideBracketConfig` second, the
   * density preset third, the shipped defaults last. Read this rather than the inputs - an input alone
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
      rowSpanRoundId: this.rowSpanRoundId() === undefined ? this.config.rowSpanRoundId : this.rowSpanRoundId(),
      thirdPlaceTopOffset:
        this.thirdPlaceTopOffset() === undefined ? this.config.thirdPlaceTopOffset : this.thirdPlaceTopOffset(),
      finalRoundHeaderGap:
        this.finalRoundHeaderGap() === undefined ? this.config.finalRoundHeaderGap : this.finalRoundHeaderGap(),
      alignRoundHeaders: this.alignRoundHeaders() ?? this.config.alignRoundHeaders,
      focusInset: this.focusInset() ?? this.config.focusInset,
      lineStartingCurveAmount: this.lineStartingCurveAmount() ?? this.config.lineStartingCurveAmount,
      lineEndingCurveAmount: this.lineEndingCurveAmount() ?? this.config.lineEndingCurveAmount,
      lineWidth: this.lineWidth() ?? this.config.lineWidth,
      lineDashArray: this.lineDashArray() ?? this.config.lineDashArray,
      lineDashOffset: this.lineDashOffset() ?? this.config.lineDashOffset,
      disableJourneyHighlight: this.disableJourneyHighlight() ?? this.config.disableJourneyHighlight,
      swissGroupPadding: this.swissGroupPadding() ?? this.config.swissGroupPadding,
      swissGroupBorderRadius: this.swissGroupBorderRadius() ?? this.config.swissGroupBorderRadius,
      hideRoundHeaders: this.hideRoundHeaders() ?? this.config.hideRoundHeaders,
      showContinueElement: this.showContinueElement() ?? this.config.showContinueElement,
      continueColumnWidth: this.continueColumnWidth() ?? this.config.continueColumnWidth,
      continueElementHeight: this.continueElementHeight() ?? this.config.continueElementHeight,
      continueLineDashArray: this.continueLineDashArray() ?? this.config.continueLineDashArray,
      roundHeaderLevel: this.roundHeaderLevel(),
    }),
  );

  private resolvedLayout = createBracketHostLayout(this.layouts, this.source, this.config);

  public bracketData = computed(() =>
    createBracket(this.source(), {
      layout: this.resolvedLayout().dataLayout,
      previousMatchIds: this.previousMatchIds(),
      onWarning: bracketHostWarningHandler(),
    }),
  );

  private journeyParticipants = computed(() => createBracketJourneyParticipants(this.bracketData()));

  public bracketGrid = computed(() => {
    const layout = this.resolvedLayout();
    const bracketData = this.bracketData();
    const options = createBracketGridConfig(this.settings(), layout.dataLayout);

    const components = resolveBracketComponents({
      overrides: {
        roundHeader: this.roundHeaderComponent(),
        match: this.matchComponent(),
        finalMatch: this.finalMatchComponent(),
        continue: this.continueComponent(),
      },
      config: this.config,
      layoutComponents: layout.components,
      showsContinueElement: !!options.continueElement,
    });

    return layout.createGrid(bracketData, options, components);
  });

  /** The connectors, group borders and gradients the active layout draws for this grid. */
  public drawing = computed(() =>
    this.resolvedLayout().drawEdges({
      grid: this.bracketGrid(),
      settings: this.settings(),
      idPrefix: this.elementId,
      colors: this.swissColors(),
    }),
  );

  protected focusRoundOffset = computed(() => {
    const focusRoundId = this.focusRoundId();

    if (!focusRoundId) return 0;

    const column = this.bracketGrid().columns.find((candidate) =>
      candidate.elements.some(
        (element) =>
          'round' in element &&
          (element.round.id === focusRoundId || element.round.id.startsWith(`${focusRoundId}--half-`)),
      ),
    );

    return (column?.dimensions.left ?? 0) - this.settings().focusInset;
  });

  constructor() {
    this.setupJourneyHighlight();
    this.setupLayoutStyles();

    warnUnknownBracketRoundIds(this.source, {
      focusRoundId: this.focusRoundId,
      rowSpanRoundId: () => this.settings().rowSpanRoundId,
    });
  }

  /**
   * Narrows a finalized element's component (a union of differently-shaped `Type`s) to the
   * `Type<unknown>` that `NgComponentOutlet` expects, keeping the cast out of the template.
   */
  protected componentFor(element: FinalizedBracketElement<TRoundData, TMatchData>): Type<unknown> {
    return element.component as Type<unknown>;
  }

  /**
   * CSS an optional layout brings along (the swiss group border) mounts app-wide on first use - the
   * style manager dedupes by type, so a page of swiss brackets injects one `<style>`.
   */
  private setupLayoutStyles() {
    const styleManager = injectStyleManager();

    effect(() => {
      for (const styles of this.resolvedLayout().styles ?? []) {
        styleManager.mount(styles);
      }
    });
  }

  private setupJourneyHighlight() {
    const renderer = injectRenderer();
    const ngZone = inject(NgZone);
    const elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    const host = elementRef.nativeElement;

    const journeyHighlightDisabled = computed(() => this.settings().disableJourneyHighlight);

    effect((onCleanup) => {
      if (journeyHighlightDisabled()) {
        this.journeyController.set(null);

        return;
      }

      const controller = ngZone.runOutsideAngular(() =>
        setupJourneyHighlightListeners({
          host,
          renderer,
          participants: this.journeyParticipants,
          onFocusChange: (participantId) => ngZone.run(() => this.focusedParticipantId.set(participantId)),
        }),
      );

      this.journeyController.set(controller);

      onCleanup(() => controller.destroy());
    });

    // After render, not in an effect: the marks are classes on cells the grid's `@for` re-uses and on
    // connector paths a redraw re-parses, so they have to be re-applied once the new nodes exist - an
    // effect runs before the view is refreshed and would mark the old drawing. Reading the grid is what
    // makes a new source (or new settings) re-run this at all.
    afterRenderEffect(() => {
      this.bracketGrid();
      this.journeyController()?.setFocused(this.focusedParticipantId());
    });
  }
}
