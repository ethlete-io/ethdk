import { NgComponentOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
  ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import {
  BracketData,
  generateBracketRoundSwissGroupMaps,
  generateBracketRoundTypeMap,
  generateMatchParticipantMap,
  generateMatchPositionMaps,
  generateMatchRelations,
  generateRoundRelations,
} from './bracket-new';
import { drawMan } from './draw-man';
import { generateBracketGridDefinitions } from './grid-definitions';
import { BracketMatchComponent, BracketRoundHeaderComponent, generateBracketGridItems } from './grid-placements';

@Component({
  selector: 'et-new-bracket',
  templateUrl: './new-bracket.component.html',
  styleUrl: './new-bracket.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-new-bracket-host',
  },
  imports: [NgComponentOutlet],
})
export class NewBracketComponent<TRoundData = unknown, TMatchData = unknown> {
  #domSanitizer = inject(DomSanitizer);
  bracketData = input.required<BracketData<TRoundData, TMatchData>>();

  columnWidth = input(250, { transform: numberAttribute });
  matchHeight = input(75, { transform: numberAttribute });
  roundHeaderHeight = input(50, { transform: numberAttribute });
  columnGap = input(60, { transform: numberAttribute });
  rowGap = input(30, { transform: numberAttribute });

  hideRoundHeaders = input(false, { transform: booleanAttribute });

  roundHeaderComponent = input<BracketRoundHeaderComponent<TRoundData, TMatchData> | undefined>();
  matchComponent = input<BracketMatchComponent<TRoundData, TMatchData> | undefined>();

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
      },
    ),
  );

  definitions = computed(() =>
    generateBracketGridDefinitions(this.bracketData(), this.roundTypeMap(), {
      includeRoundHeaders: !this.hideRoundHeaders(),
    }),
  );

  drawManData = computed(() =>
    this.#domSanitizer.bypassSecurityTrustHtml(
      drawMan(this.items(), this.roundRelations(), {
        columnGap: this.columnGap(),
        columnWidth: this.columnWidth(),
        matchHeight: this.matchHeight(),
        roundHeaderHeight: this.hideRoundHeaders() ? 0 : this.roundHeaderHeight(),
        rowGap: this.rowGap(),
        gridDefinitions: this.definitions(),
      }),
    ),
  );
}
