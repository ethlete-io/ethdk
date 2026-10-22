import { Component, ViewEncapsulation } from '@angular/core';
import { MATCH_CARD_IMPORTS } from '@ethlete/components';
import { STATE_MATCHES } from './match-states.data';

@Component({
  selector: 'app-match-states-example',
  template: `
    @for (width of widths; track width) {
      <div [style.inline-size.px]="width">
        @for (match of matches; track match.id) {
          <et-match-card [match]="match" />
        }
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS],
})
export class MatchStatesExampleComponent {
  public widths = [220, 400, 620];
  public matches = STATE_MATCHES;
}
