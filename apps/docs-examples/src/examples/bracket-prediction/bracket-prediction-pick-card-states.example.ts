import { Component, ViewEncapsulation } from '@angular/core';
import { BRACKET_PICK_CARD_IMPORTS } from '@ethlete/components';
import { CASES } from './bracket-prediction-pick-card-states.data';

@Component({
  selector: 'app-bracket-prediction-pick-card-states-example',
  template: `
    <div [style.max-inline-size.px]="420">
      @for (item of cases; track item.title) {
        <p>{{ item.title }}</p>

        <div [style.block-size.px]="88">
          <et-bracket-pick-card
            [bracketMatch]="item.bracketMatch"
            [normalized]="item.normalized"
            [pickedSide]="item.pickedSide"
            [note]="item.note"
            [noteTone]="item.noteTone"
            [locked]="item.locked"
            [disabled]="item.disabled"
            [readonly]="item.readonly"
            [earlierRoundsClosed]="item.earlierRoundsClosed"
          />
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BRACKET_PICK_CARD_IMPORTS],
})
export class BracketPredictionPickCardStatesExampleComponent {
  public cases = CASES;
}
