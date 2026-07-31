import { NgComponentOutlet } from '@angular/common';
import {
  booleanAttribute,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  numberAttribute,
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
import { setupJourneyHighlight as setupJourneyHighlightListeners } from './journey-highlight';
import { createBracket, generateBracketRoundSwissGroupMaps } from './linked';
import { BRACKET_CARD_CONTEXT, BracketMatchNormalizer } from './bracket-card-context';
import { resolveBracketComponents } from './bracket-components';
import { computeBracketGrid, createBracketGridConfig } from './bracket-grid';
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

  public columnWidth = input(this.config.columnWidth ?? BRACKET_DEFAULTS.columnWidth, { transform: numberAttribute });
  public matchHeight = input(this.config.matchHeight ?? BRACKET_DEFAULTS.matchHeight, { transform: numberAttribute });
  public finalMatchHeight = input(this.config.finalMatchHeight ?? BRACKET_DEFAULTS.finalMatchHeight, {
    transform: numberAttribute,
  });
  public finalColumnWidth = input(this.config.finalColumnWidth ?? BRACKET_DEFAULTS.finalColumnWidth, {
    transform: numberAttribute,
  });
  public roundHeaderHeight = input(this.config.roundHeaderHeight ?? BRACKET_DEFAULTS.roundHeaderHeight, {
    transform: numberAttribute,
  });
  public roundHeaderGap = input(this.config.roundHeaderGap ?? BRACKET_DEFAULTS.roundHeaderGap, {
    transform: numberAttribute,
  });
  public columnGap = input(this.config.columnGap ?? BRACKET_DEFAULTS.columnGap, { transform: numberAttribute });
  public rowGap = input(this.config.rowGap ?? BRACKET_DEFAULTS.rowGap, { transform: numberAttribute });
  public rowRoundGap = input(this.config.rowRoundGap ?? BRACKET_DEFAULTS.rowRoundGap, { transform: numberAttribute });
  public lineStartingCurveAmount = input(
    this.config.lineStartingCurveAmount ?? BRACKET_DEFAULTS.lineStartingCurveAmount,
    { transform: numberAttribute },
  );
  public lineEndingCurveAmount = input(this.config.lineEndingCurveAmount ?? BRACKET_DEFAULTS.lineEndingCurveAmount, {
    transform: numberAttribute,
  });
  public lineWidth = input(this.config.lineWidth ?? BRACKET_DEFAULTS.lineWidth, { transform: numberAttribute });
  public lineDashArray = input(this.config.lineDashArray ?? BRACKET_DEFAULTS.lineDashArray, {
    transform: numberAttribute,
  });
  public lineDashOffset = input(this.config.lineDashOffset ?? BRACKET_DEFAULTS.lineDashOffset, {
    transform: numberAttribute,
  });
  public disableJourneyHighlight = input(
    this.config.disableJourneyHighlight ?? BRACKET_DEFAULTS.disableJourneyHighlight,
    { transform: booleanAttribute },
  );
  public swissGroupPadding = input(this.config.swissGroupPadding ?? BRACKET_DEFAULTS.swissGroupPadding, {
    transform: numberAttribute,
  });
  public swissGroupBorderRadius = input(this.config.swissGroupBorderRadius ?? BRACKET_DEFAULTS.swissGroupBorderRadius, {
    transform: numberAttribute,
  });
  public swissColors = input<BracketSwissColors | undefined>(this.config.swiss?.colors);

  public layout = input<BracketDataLayout>(this.config.layout ?? BRACKET_DEFAULTS.layout);
  public hideRoundHeaders = input(this.config.hideRoundHeaders ?? BRACKET_DEFAULTS.hideRoundHeaders, {
    transform: booleanAttribute,
  });

  public showContinueElement = input(this.config.showContinueElement ?? BRACKET_DEFAULTS.showContinueElement, {
    transform: booleanAttribute,
  });
  public continueColumnWidth = input(this.config.continueColumnWidth ?? BRACKET_DEFAULTS.continueColumnWidth, {
    transform: numberAttribute,
  });
  public continueElementHeight = input(this.config.continueElementHeight ?? BRACKET_DEFAULTS.continueElementHeight, {
    transform: numberAttribute,
  });
  public continueLineDashArray = input(this.config.continueLineDashArray ?? BRACKET_DEFAULTS.continueLineDashArray, {
    transform: numberAttribute,
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

  /** @internal The normalizer in effect, read by the default cards through `BRACKET_CARD_CONTEXT`. */
  public resolvedMatchNormalizer = computed<BracketMatchNormalizer | null>(
    () => this.matchNormalizer() ?? this.config.matchNormalizer ?? null,
  );

  /** @internal The heading level in effect, read by the default round headers. */
  public resolvedRoundHeaderLevel = computed(() => this.roundHeaderLevel());

  private elementId = createComponentId('et-bracket');

  public bracketData = computed(() => createBracket(this.source(), { layout: this.layout() }));

  public swissGroups = computed(() => generateBracketRoundSwissGroupMaps(this.bracketData()));

  public bracketGrid = computed(() => {
    const bracketData = this.bracketData();

    const options = createBracketGridConfig({
      columnGap: this.columnGap(),
      rowRoundGap: this.rowRoundGap(),
      columnWidth: this.columnWidth(),
      matchHeight: this.matchHeight(),
      roundHeaderHeight: this.roundHeaderHeight(),
      rowGap: this.rowGap(),
      layout: this.layout(),
      finalMatchHeight: this.finalMatchHeight(),
      finalColumnWidth: this.finalColumnWidth(),
      roundHeaderGap: this.roundHeaderGap(),
      hideRoundHeaders: this.hideRoundHeaders(),
      swissGroupPadding: this.swissGroupPadding(),
      lineWidth: this.lineWidth(),
      showContinueElement: this.showContinueElement(),
      continueColumnWidth: this.continueColumnWidth(),
      continueElementHeight: this.continueElementHeight(),
    });

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

    if (this.bracketData().mode === TOURNAMENT_MODE.SWISS_WITH_ELIMINATION) {
      return drawSwissMan({
        bracketGrid,
        curve: {
          lineStartingCurveAmount: this.lineStartingCurveAmount(),
        },
        path: {
          dashArray: this.lineDashArray(),
          dashOffset: this.lineDashOffset(),
          width: this.lineWidth(),
        },
        groupBorder: {
          padding: this.swissGroupPadding(),
          radius: this.swissGroupBorderRadius(),
          width: this.lineWidth(),
        },
        colors: this.swissColors(),
        idPrefix: this.elementId,
      });
    }

    return drawMan({
      columnGap: this.columnGap(),
      upperLowerGap: this.rowRoundGap(),
      columnWidth: this.columnWidth(),
      matchHeight: this.matchHeight(),
      roundHeaderHeight: this.hideRoundHeaders() ? 0 : this.roundHeaderHeight(),
      rowGap: this.rowGap(),
      bracketGrid,
      curve: {
        lineEndingCurveAmount: this.lineEndingCurveAmount(),
        lineStartingCurveAmount: this.lineStartingCurveAmount(),
      },
      path: {
        dashArray: this.lineDashArray(),
        dashOffset: this.lineDashOffset(),
        width: this.lineWidth(),
      },
      continuePath: {
        dashArray: this.continueLineDashArray(),
        dashOffset: this.lineDashOffset(),
        width: this.lineWidth(),
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
      if (this.disableJourneyHighlight()) return;

      const teardown = ngZone.runOutsideAngular(() => setupJourneyHighlightListeners(host, renderer));

      // via onCleanup, not a returned function: effect() ignores what the callback returns, so the
      // listeners would stack up on every re-run and outlive the component.
      onCleanup(() => teardown());
    });
  }
}
