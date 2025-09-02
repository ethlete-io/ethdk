import { NgComponentOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  inject,
  input,
  numberAttribute,
  Renderer2,
  ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { createComponentId } from '@ethlete/core';
import { BRACKET_DATA_LAYOUT, BracketDataLayout, TOURNAMENT_MODE } from './core';
import { drawMan } from './drawing';
import { createDoubleEliminationGrid, createSingleEliminationGrid, gridColumnsToGridProperty } from './drawing/grid';
import { BracketComponents } from './drawing/grid/prebuild';
import { generateBracketGridDefinitions, GenerateBracketGridDefinitionsOptions } from './grid-definitions';
import { BracketMatchComponent, BracketRoundHeaderComponent, generateBracketGridItems } from './grid-placements';
import { BracketDataSource } from './integrations';
import { createJourneyHighlight } from './journey-highlight';
import { createNewBracket, generateBracketRoundSwissGroupMaps, getFirstRounds, logRoundRelations } from './linked';
import { NewBracketDebugComponent } from './new-bracket-debug.component';
import { NewBracketDefaultMatchComponent } from './new-bracket-default-match.component';
import { NewBracketDefaultRoundHeaderComponent } from './new-bracket-default-round-header.component';

@Component({
  selector: 'et-new-bracket',
  templateUrl: './new-bracket.component.html',
  styleUrl: './new-bracket.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-new-bracket-host',
  },
  imports: [NgComponentOutlet, NewBracketDebugComponent],
})
export class NewBracketComponent<TRoundData = unknown, TMatchData = unknown> {
  private domSanitizer = inject(DomSanitizer);
  private elementId = createComponentId('et-new-bracket');

  source = input.required<BracketDataSource<TRoundData, TMatchData>>();

  columnWidth = input(250, { transform: numberAttribute });
  matchHeight = input(75, { transform: numberAttribute });
  finalMatchHeight = input(75, { transform: numberAttribute });
  finalColumnWidth = input(300, { transform: numberAttribute });
  roundHeaderHeight = input(50, { transform: numberAttribute });
  columnGap = input(60, { transform: numberAttribute });
  rowGap = input(30, { transform: numberAttribute });
  upperLowerGap = input(20, { transform: numberAttribute });
  lineStartingCurveAmount = input(10, { transform: numberAttribute });
  lineEndingCurveAmount = input(0, { transform: numberAttribute });
  lineWidth = input(2, { transform: numberAttribute });
  lineDashArray = input(0, { transform: numberAttribute });
  lineDashOffset = input(0, { transform: numberAttribute });
  disableJourneyHighlight = input(false, { transform: booleanAttribute });
  debug = input(false, { transform: booleanAttribute });

  layout = input<BracketDataLayout>(BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT);
  hideRoundHeaders = input(false, { transform: booleanAttribute });

  roundHeaderComponent = input<BracketRoundHeaderComponent<TRoundData, TMatchData> | undefined>();
  matchComponent = input<BracketMatchComponent<TRoundData, TMatchData> | undefined>();
  finalMatchComponent = input<BracketMatchComponent<TRoundData, TMatchData> | undefined>();

  bracketData = computed(() => createNewBracket(this.source(), { layout: this.layout() }));

  swissGroups = computed(() => generateBracketRoundSwissGroupMaps(this.bracketData()));

  items = computed(() =>
    generateBracketGridItems({
      bracketData: this.bracketData(),
      swissGroups: this.swissGroups(),
      options: {
        includeRoundHeaders: !this.hideRoundHeaders(),
        headerComponent: this.roundHeaderComponent(),
        matchComponent: this.matchComponent(),
        finalMatchComponent: this.finalMatchComponent(),
      },
    }),
  );

  definitions = computed(() =>
    generateBracketGridDefinitions(this.bracketData(), {
      includeRoundHeaders: !this.hideRoundHeaders(),
      columnGap: this.columnGap(),
      upperLowerGap: this.bracketData().mode === TOURNAMENT_MODE.DOUBLE_ELIMINATION ? this.upperLowerGap() : 0,
      columnWidth: this.columnWidth(),
      matchHeight: this.matchHeight(),
      roundHeaderHeight: this.hideRoundHeaders() ? 0 : this.roundHeaderHeight(),
      rowGap: this.rowGap(),
      layout: this.layout(),
      finalMatchHeight: this.finalMatchComponent() ? this.finalMatchHeight() : this.matchHeight(),
      finalColumnWidth: this.finalMatchComponent() ? this.finalColumnWidth() : this.columnWidth(),
    }),
  );

  newDefinitions = computed(() => {
    const bracketData = this.bracketData();

    const options: GenerateBracketGridDefinitionsOptions = {
      includeRoundHeaders: !this.hideRoundHeaders(),
      columnGap: this.columnGap(),
      upperLowerGap: this.bracketData().mode === TOURNAMENT_MODE.DOUBLE_ELIMINATION ? this.upperLowerGap() : 0,
      columnWidth: this.columnWidth(),
      matchHeight: this.matchHeight(),
      roundHeaderHeight: this.hideRoundHeaders() ? 0 : this.roundHeaderHeight(),
      rowGap: this.rowGap(),
      layout: this.layout(),
      finalMatchHeight: this.finalMatchHeight(),
      finalColumnWidth: this.finalColumnWidth(),
    };

    const components: BracketComponents<TRoundData, TMatchData> = {
      match: this.matchComponent() ?? NewBracketDefaultMatchComponent,
      finalMatch: this.finalMatchComponent() ?? NewBracketDefaultMatchComponent,
      roundHeader: this.roundHeaderComponent() ?? NewBracketDefaultRoundHeaderComponent,
    };

    switch (bracketData.mode) {
      case TOURNAMENT_MODE.DOUBLE_ELIMINATION: {
        const grid = createDoubleEliminationGrid(bracketData, options, components);

        return {
          css: gridColumnsToGridProperty(grid.raw.grid.masterColumns),
          grid,
        };
      }
      case TOURNAMENT_MODE.SINGLE_ELIMINATION: {
        const grid = createSingleEliminationGrid(bracketData, options, components);

        return { css: gridColumnsToGridProperty(grid.raw.grid.masterColumns), grid };
      }
    }

    return null;
  });

  firstRounds = computed(() => getFirstRounds(this.bracketData()));

  drawManData = computed(() => {
    if (this.bracketData().mode !== TOURNAMENT_MODE.SINGLE_ELIMINATION)
      return {
        svg: '',
      };

    return drawMan(this.items(), this.firstRounds(), {
      columnGap: this.columnGap(),
      upperLowerGap: this.bracketData().mode === TOURNAMENT_MODE.DOUBLE_ELIMINATION ? this.upperLowerGap() : 0,
      columnWidth: this.columnWidth(),
      matchHeight: this.matchHeight(),
      roundHeaderHeight: this.hideRoundHeaders() ? 0 : this.roundHeaderHeight(),
      rowGap: this.rowGap(),
      gridDefinitions: this.definitions(),
      curve: {
        lineEndingCurveAmount: this.lineEndingCurveAmount(),
        lineStartingCurveAmount: this.lineStartingCurveAmount(),
      },
      path: {
        dashArray: this.lineDashArray(),
        dashOffset: this.lineDashOffset(),
        width: this.lineWidth(),
      },
    });
  });

  svgContent = computed(() => this.domSanitizer.bypassSecurityTrustHtml(this.drawManData().svg));

  journeyHighlight = computed(() =>
    this.disableJourneyHighlight() ? null : createJourneyHighlight(this.bracketData()),
  );

  constructor() {
    this.setupJourneyHighlight();

    effect(() => {
      logRoundRelations(this.bracketData());
      console.log(this.bracketData());
    });
  }

  private setupJourneyHighlight() {
    const renderer = inject(Renderer2);
    const doc = inject(DOCUMENT);
    const styleId = `et-new-bracket-journey-highlight--${this.elementId}`;

    let oldStyleEl: unknown = null;

    effect(() => {
      const newHighlightStyle = this.journeyHighlight();
      const head = doc.head;

      if (oldStyleEl) {
        renderer.removeChild(head, oldStyleEl);
      }

      if (newHighlightStyle) {
        const el = renderer.createElement('style');
        renderer.setAttribute(el, 'id', styleId);
        renderer.appendChild(el, renderer.createText(newHighlightStyle));

        renderer.appendChild(head, el);
        oldStyleEl = el;
      } else {
        oldStyleEl = null;
      }

      return () => {
        if (oldStyleEl) {
          renderer.removeChild(head, oldStyleEl);
          oldStyleEl = null;
        }
      };
    });
  }
}
