import { Component, input, ViewEncapsulation } from '@angular/core';
import { BracketNew, NewBracketComponent, ScrollableImports } from '@ethlete/cdk';
import { DOUBLE_ELIMINATION_SOURCE, TEAMS } from './cdk-bracket-double-elimination.data';

@Component({
  selector: 'app-cdk-bracket-match',
  template: `
    <p>{{ name(bracketMatch().home?.id) }}</p>
    <p>{{ name(bracketMatch().away?.id) }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class CdkBracketMatchComponent {
  public bracketRound = input.required<BracketNew.NewBracketRound<null, null>>();
  public bracketMatch = input.required<BracketNew.NewBracketMatch<null, null>>();
  public bracketRoundSwissGroup = input.required<BracketNew.BracketRoundSwissGroup<null, null> | null>();

  public name(id: string | undefined) {
    return id ? (TEAMS[id]?.name ?? id) : 'TBD';
  }
}

@Component({
  selector: 'app-cdk-bracket-double-elimination-example',
  template: `
    <et-scrollable stickyButtons>
      <et-new-bracket
        [source]="source"
        [matchComponent]="matchComponent"
        [finalMatchComponent]="matchComponent"
        [matchHeight]="60"
      />
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NewBracketComponent, ScrollableImports],
})
export class CdkBracketDoubleEliminationExampleComponent {
  public source = DOUBLE_ELIMINATION_SOURCE;
  public matchComponent = CdkBracketMatchComponent;
}
