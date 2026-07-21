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
} from './drawing/grid';
import { BracketDataSource } from './integrations';
import { setupJourneyHighlight as setupJourneyHighlightListeners } from './journey-highlight';
import { createNewBracket, generateBracketRoundSwissGroupMaps } from './linked';
import { NewBracketDefaultContinueComponent } from './new-bracket-default-continue.component';
import { NewBracketDefaultMatchComponent } from './new-bracket-default-match.component';
import { NewBracketDefaultRoundHeaderComponent } from './new-bracket-default-round-header.component';
import { BracketSwissColors, injectNewBracketConfig } from './new-bracket.config';

@Component({
  selector: 'et-new-bracket',
  templateUrl: './new-bracket.component.html',
  styleUrl: './new-bracket.component.scss',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-new-bracket-host et-legacy',
  },
  imports: [NgComponentOutlet],
})
export class NewBracketComponent<TRoundData = unknown, TMatchData = unknown> {
  private domSanitizer = inject(DomSanitizer);
  private elementId = createComponentId('et-new-bracket');
  private config = injectNewBracketConfig();

  source = input.required<BracketDataSource<TRoundData, TMatchData>>();

  columnWidth = input(this.config.columnWidth ?? 250, { transform: numberAttribute });
  matchHeight = input(this.config.matchHeight ?? 75, { transform: numberAttribute });
  finalMatchHeight = input(this.config.finalMatchHeight ?? 75, { transform: numberAttribute });
  finalColumnWidth = input(this.config.finalColumnWidth ?? 300, { transform: numberAttribute });
  roundHeaderHeight = input(this.config.roundHeaderHeight ?? 50, { transform: numberAttribute });
  roundHeaderGap = input(this.config.roundHeaderGap ?? 20, { transform: numberAttribute });
  columnGap = input(this.config.columnGap ?? 60, { transform: numberAttribute });
  rowGap = input(this.config.rowGap ?? 30, { transform: numberAttribute });
  rowRoundGap = input(this.config.rowRoundGap ?? 20, { transform: numberAttribute });
  lineStartingCurveAmount = input(this.config.lineStartingCurveAmount ?? 10, { transform: numberAttribute });
  lineEndingCurveAmount = input(this.config.lineEndingCurveAmount ?? 0, { transform: numberAttribute });
  lineWidth = input(this.config.lineWidth ?? 2, { transform: numberAttribute });
  lineDashArray = input(this.config.lineDashArray ?? 0, { transform: numberAttribute });
  lineDashOffset = input(this.config.lineDashOffset ?? 0, { transform: numberAttribute });
  disableJourneyHighlight = input(this.config.disableJourneyHighlight ?? false, { transform: booleanAttribute });
  swissGroupPadding = input(this.config.swissGroupPadding ?? 10, { transform: numberAttribute });
  swissGroupBorderRadius = input(this.config.swissGroupBorderRadius ?? 12, { transform: numberAttribute });
  swissColors = input<BracketSwissColors | undefined>(this.config.swiss?.colors);

  layout = input<BracketDataLayout>(this.config.layout ?? BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT);
  hideRoundHeaders = input(this.config.hideRoundHeaders ?? false, { transform: booleanAttribute });

  showContinueElement = input(this.config.showContinueElement ?? false, { transform: booleanAttribute });
  continueColumnWidth = input(this.config.continueColumnWidth ?? 250, { transform: numberAttribute });
  continueElementHeight = input(this.config.continueElementHeight ?? 75, { transform: numberAttribute });
  continueLineDashArray = input(this.config.continueLineDashArray ?? 6, { transform: numberAttribute });

  roundHeaderComponent = input<BracketRoundHeaderComponent<TRoundData, TMatchData> | undefined>();
  matchComponent = input<BracketMatchComponent<TRoundData, TMatchData> | undefined>();
  finalMatchComponent = input<BracketMatchComponent<TRoundData, TMatchData> | undefined>();
  continueComponent = input<BracketContinueComponent<TRoundData, TMatchData> | undefined>();

  bracketData = computed(() => createNewBracket(this.source(), { layout: this.layout() }));

  swissGroups = computed(() => generateBracketRoundSwissGroupMaps(this.bracketData()));

  bracketGrid = computed(() => {
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
        NewBracketDefaultMatchComponent,
      finalMatch: this.finalMatchComponent() ?? this.config.finalMatchComponent ?? NewBracketDefaultMatchComponent,
      roundHeader:
        this.roundHeaderComponent() ??
        swissConfig?.roundHeaderComponent ??
        this.config.roundHeaderComponent ??
        NewBracketDefaultRoundHeaderComponent,
      continue: this.continueComponent() ?? this.config.continueComponent ?? NewBracketDefaultContinueComponent,
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

  drawManData = computed(() => {
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

  svgContent = computed(() => this.domSanitizer.bypassSecurityTrustHtml(this.drawManData()));

  constructor() {
    this.setupJourneyHighlight();
  }

  private setupJourneyHighlight() {
    const renderer = injectRenderer();
    const ngZone = inject(NgZone);
    const host = inject(ElementRef<HTMLElement>).nativeElement;

    effect(() => {
      if (this.disableJourneyHighlight()) return;

      const teardown = ngZone.runOutsideAngular(() => setupJourneyHighlightListeners(host, renderer));

      return () => teardown();
    });
  }
}
