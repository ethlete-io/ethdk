import { isPlatformBrowser, NgComponentOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  numberAttribute,
  PLATFORM_ID,
  Renderer2,
  ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { createComponentId } from '@ethlete/core';
import {
  BRACKET_DATA_LAYOUT,
  BracketDataLayout,
  BracketDataSource,
  generateBracketData,
  generateBracketRoundSwissGroupMaps,
  generateBracketRoundTypeMap,
  generateMatchParticipantMap,
  generateMatchPositionMaps,
  generateMatchRelations,
  generateRoundRelations,
  getFirstRounds,
} from './bracket-new';
import { drawMan } from './draw-man';
import { generateBracketGridDefinitions } from './grid-definitions';
import { BracketMatchComponent, BracketRoundHeaderComponent, generateBracketGridItems } from './grid-placements';
import { createJourneyHighlight } from './journey-highlight';

@Component({
  selector: 'et-new-bracket',
  templateUrl: './new-bracket.component.html',
  styleUrl: './new-bracket.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-new-bracket-host',
  },
  imports: [NgComponentOutlet],
})
export class NewBracketComponent<TRoundData = unknown, TMatchData = unknown> {
  #domSanitizer = inject(DomSanitizer);
  #elementId = createComponentId('et-new-bracket');

  source = input.required<BracketDataSource<TRoundData, TMatchData>>();

  columnWidth = input(250, { transform: numberAttribute });
  matchHeight = input(75, { transform: numberAttribute });
  roundHeaderHeight = input(50, { transform: numberAttribute });
  columnGap = input(60, { transform: numberAttribute });
  rowGap = input(30, { transform: numberAttribute });
  lineStartingCurveAmount = input(10, { transform: numberAttribute });
  lineEndingCurveAmount = input(0, { transform: numberAttribute });
  lineWidth = input(2, { transform: numberAttribute });
  lineDashArray = input(0, { transform: numberAttribute });
  lineDashOffset = input(0, { transform: numberAttribute });
  disableJourneyHighlight = input(false, { transform: booleanAttribute });

  layout = input<BracketDataLayout>(BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT);
  hideRoundHeaders = input(false, { transform: booleanAttribute });

  roundHeaderComponent = input<BracketRoundHeaderComponent<TRoundData, TMatchData> | undefined>();
  matchComponent = input<BracketMatchComponent<TRoundData, TMatchData> | undefined>();
  finalMatchComponent = input<BracketMatchComponent<TRoundData, TMatchData> | undefined>();

  bracketData = computed(() => generateBracketData(this.source(), { layout: this.layout() }));

  roundTypeMap = computed(() => generateBracketRoundTypeMap(this.bracketData()));
  matchParticipantMap = computed(() => generateMatchParticipantMap(this.bracketData()));
  matchPositionsMap = computed(() => generateMatchPositionMaps(this.bracketData()));

  roundRelations = computed(() => generateRoundRelations(this.bracketData()));
  matchRelations = computed(() =>
    generateMatchRelations(this.bracketData(), this.roundRelations(), this.matchPositionsMap()),
  );

  swissGroups = computed(() => generateBracketRoundSwissGroupMaps(this.bracketData(), this.matchParticipantMap()));

  items = computed(() =>
    generateBracketGridItems(
      this.bracketData(),
      this.roundTypeMap(),
      this.swissGroups(),
      this.roundRelations(),
      this.matchRelations(),
      {
        includeRoundHeaders: !this.hideRoundHeaders(),
        headerComponent: this.roundHeaderComponent(),
        matchComponent: this.matchComponent(),
        finalMatchComponent: this.finalMatchComponent(),
      },
    ),
  );

  definitions = computed(() =>
    generateBracketGridDefinitions(this.bracketData(), this.roundTypeMap(), {
      includeRoundHeaders: !this.hideRoundHeaders(),
    }),
  );

  firstRounds = computed(() => getFirstRounds(this.bracketData(), this.roundTypeMap()));

  drawManData = computed(() =>
    this.#domSanitizer.bypassSecurityTrustHtml(
      drawMan(this.items(), this.firstRounds(), {
        columnGap: this.columnGap(),
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
      }),
    ),
  );

  journeyHighlight = computed(() =>
    this.disableJourneyHighlight() ? null : createJourneyHighlight(this.bracketData()),
  );

  constructor() {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

    if (!isBrowser) return;

    const renderer = inject(Renderer2);
    const styleId = `et-new-bracket-journey-highlight--${this.#elementId}`;

    let oldStyleEl: unknown = null;

    effect(() => {
      const newHighlightStyle = this.journeyHighlight();
      const head = document.head;

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
    });

    inject(DestroyRef).onDestroy(() => {
      if (oldStyleEl) {
        renderer.removeChild(document.head, oldStyleEl);
      }
    });
  }
}
