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
import { BRACKET_DATA_LAYOUT, BracketDataLayout, TOURNAMENT_MODE } from './core';
import { drawMan, drawSwissMan } from './drawing';
import {
  BracketComponents,
  BracketContinueComponent,
  BracketMatchComponent,
  BracketRoundHeaderComponent,
  CreateBracketGridConfig,
  createDoubleEliminationGrid,
  createSingleEliminationGrid,
  createSwissGrid,
  FinalizedBracketElement,
} from './drawing/grid';
import { BracketDataSource } from './integrations';
import { setupJourneyHighlight as setupJourneyHighlightListeners } from './journey-highlight';
import { createBracket, generateBracketRoundSwissGroupMaps } from './linked';
import { BracketDefaultContinueComponent } from './bracket-default-continue.component';
import { BracketDefaultMatchComponent } from './bracket-default-match.component';
import { BracketDefaultRoundHeaderComponent } from './bracket-default-round-header.component';
import { BracketSwissColors, injectBracketConfig } from './bracket.config';

@Component({
  selector: 'et-bracket',
  templateUrl: './bracket.component.html',
  styleUrl: './bracket.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgComponentOutlet],
  host: {
    class: 'et-bracket-host',
  },
})
export class BracketComponent<TRoundData = unknown, TMatchData = unknown> {
  private domSanitizer = inject(DomSanitizer);
  private config = injectBracketConfig();

  public source = input.required<BracketDataSource<TRoundData, TMatchData>>();

  public columnWidth = input(this.config.columnWidth ?? 250, { transform: numberAttribute });
  public matchHeight = input(this.config.matchHeight ?? 75, { transform: numberAttribute });
  public finalMatchHeight = input(this.config.finalMatchHeight ?? 75, { transform: numberAttribute });
  public finalColumnWidth = input(this.config.finalColumnWidth ?? 300, { transform: numberAttribute });
  public roundHeaderHeight = input(this.config.roundHeaderHeight ?? 50, { transform: numberAttribute });
  public roundHeaderGap = input(this.config.roundHeaderGap ?? 20, { transform: numberAttribute });
  public columnGap = input(this.config.columnGap ?? 60, { transform: numberAttribute });
  public rowGap = input(this.config.rowGap ?? 30, { transform: numberAttribute });
  public rowRoundGap = input(this.config.rowRoundGap ?? 20, { transform: numberAttribute });
  public lineStartingCurveAmount = input(this.config.lineStartingCurveAmount ?? 10, { transform: numberAttribute });
  public lineEndingCurveAmount = input(this.config.lineEndingCurveAmount ?? 0, { transform: numberAttribute });
  public lineWidth = input(this.config.lineWidth ?? 2, { transform: numberAttribute });
  public lineDashArray = input(this.config.lineDashArray ?? 0, { transform: numberAttribute });
  public lineDashOffset = input(this.config.lineDashOffset ?? 0, { transform: numberAttribute });
  public disableJourneyHighlight = input(this.config.disableJourneyHighlight ?? false, { transform: booleanAttribute });
  public swissGroupPadding = input(this.config.swissGroupPadding ?? 10, { transform: numberAttribute });
  public swissGroupBorderRadius = input(this.config.swissGroupBorderRadius ?? 12, { transform: numberAttribute });
  public swissColors = input<BracketSwissColors | undefined>(this.config.swiss?.colors);

  public layout = input<BracketDataLayout>(this.config.layout ?? BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT);
  public hideRoundHeaders = input(this.config.hideRoundHeaders ?? false, { transform: booleanAttribute });

  public showContinueElement = input(this.config.showContinueElement ?? false, { transform: booleanAttribute });
  public continueColumnWidth = input(this.config.continueColumnWidth ?? 250, { transform: numberAttribute });
  public continueElementHeight = input(this.config.continueElementHeight ?? 75, { transform: numberAttribute });
  public continueLineDashArray = input(this.config.continueLineDashArray ?? 6, { transform: numberAttribute });

  public roundHeaderComponent = input<BracketRoundHeaderComponent<TRoundData, TMatchData> | undefined>();
  public matchComponent = input<BracketMatchComponent<TRoundData, TMatchData> | undefined>();
  public finalMatchComponent = input<BracketMatchComponent<TRoundData, TMatchData> | undefined>();
  public continueComponent = input<BracketContinueComponent<TRoundData, TMatchData> | undefined>();
  private elementId = createComponentId('et-bracket');

  public bracketData = computed(() => createBracket(this.source(), { layout: this.layout() }));

  public swissGroups = computed(() => generateBracketRoundSwissGroupMaps(this.bracketData()));

  public bracketGrid = computed(() => {
    const bracketData = this.bracketData();

    const options: CreateBracketGridConfig = {
      includeRoundHeaders: !this.hideRoundHeaders(),
      columnGap: this.columnGap(),
      rowRoundGap: this.rowRoundGap(),
      columnWidth: this.columnWidth(),
      matchHeight: this.matchHeight(),
      roundHeaderHeight: this.hideRoundHeaders() ? 0 : this.roundHeaderHeight(),
      rowGap: this.rowGap(),
      layout: this.layout(),
      finalMatchHeight: this.finalMatchHeight(),
      finalColumnWidth: this.finalColumnWidth(),
      roundHeaderGap: this.hideRoundHeaders() ? 0 : this.roundHeaderGap(),
      swissGroupPadding: this.swissGroupPadding(),
      swissGroupBorderWidth: this.lineWidth(),
      continueElement:
        this.showContinueElement() && this.layout() === BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT
          ? {
              columnWidth: this.continueColumnWidth(),
              elementHeight: this.continueElementHeight(),
            }
          : null,
    };

    const swissConfig = bracketData.mode === TOURNAMENT_MODE.SWISS_WITH_ELIMINATION ? this.config.swiss : undefined;

    const components: BracketComponents<TRoundData, TMatchData> = {
      match:
        this.matchComponent() ??
        swissConfig?.matchComponent ??
        this.config.matchComponent ??
        BracketDefaultMatchComponent,
      finalMatch: this.finalMatchComponent() ?? this.config.finalMatchComponent ?? BracketDefaultMatchComponent,
      roundHeader:
        this.roundHeaderComponent() ??
        swissConfig?.roundHeaderComponent ??
        this.config.roundHeaderComponent ??
        BracketDefaultRoundHeaderComponent,
      continue: this.continueComponent() ?? this.config.continueComponent ?? BracketDefaultContinueComponent,
    };

    switch (bracketData.mode) {
      case TOURNAMENT_MODE.DOUBLE_ELIMINATION:
        return createDoubleEliminationGrid(bracketData, options, components);

      case TOURNAMENT_MODE.SINGLE_ELIMINATION:
        return createSingleEliminationGrid(bracketData, options, components);

      case TOURNAMENT_MODE.SWISS_WITH_ELIMINATION:
        return createSwissGrid(bracketData, options, components);
    }
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

    effect(() => {
      if (this.disableJourneyHighlight()) return;

      const teardown = ngZone.runOutsideAngular(() => setupJourneyHighlightListeners(host, renderer));

      return () => teardown();
    });
  }
}
