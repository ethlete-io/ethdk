import { Component, input, ViewEncapsulation } from '@angular/core';
import { BracketNew, NewBracketComponent, ScrollableImports } from '@ethlete/cdk';
import { SWISS_SOURCE, SwissMatchData } from './cdk-bracket-swiss.data';

@Component({
  selector: 'app-cdk-bracket-swiss-match',
  template: `
    <p>{{ bracketMatch().data.home }}</p>
    <p>{{ bracketMatch().data.away }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class CdkBracketSwissMatchComponent {
  public bracketRound = input.required<BracketNew.NewBracketRound<null, SwissMatchData>>();
  public bracketMatch = input.required<BracketNew.NewBracketMatch<null, SwissMatchData>>();
  public bracketRoundSwissGroup = input.required<BracketNew.BracketRoundSwissGroup<null, SwissMatchData> | null>();
}

@Component({
  selector: 'app-cdk-bracket-swiss-example',
  template: `
    <et-scrollable stickyButtons>
      <et-new-bracket
        [source]="source"
        [matchComponent]="matchComponent"
        [matchHeight]="60"
        [swissColors]="swissColors"
      />
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NewBracketComponent, ScrollableImports],
})
export class CdkBracketSwissExampleComponent {
  public source = SWISS_SOURCE;
  public matchComponent = CdkBracketSwissMatchComponent;

  public swissColors = {
    neutral: '#374151',
    positive: '#17d08c',
    warning: '#f0b620',
    negative: '#f83b51',
  };
}
