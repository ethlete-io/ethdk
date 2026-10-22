import { Component, ViewEncapsulation } from '@angular/core';
import { MATCH_CARD_IMPORTS, SCROLLABLE_DRAG_IMPORTS, SCROLLABLE_IMPORTS } from '@ethlete/components';
import { RAIL_MATCHES } from './sport-recipes-match-rail.data';

@Component({
  selector: 'app-sport-recipes-match-rail-example',
  template: `
    <et-scrollable
      [itemSize]="{ xs: 'full', md: 'half', lg: 'third' }"
      etScrollableSnap
      scrollableClass="app-rail"
      scrollableRole="list"
    >
      @for (match of matches; track match.id) {
        <div [etScrollableActiveChild]="match.status === 'live'" class="app-rail-item" role="listitem">
          <et-match-card [match]="match" />
        </div>
      }
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS, SCROLLABLE_IMPORTS, SCROLLABLE_DRAG_IMPORTS],
  styles: `
    .app-rail {
      gap: 12px;
    }

    .app-rail-item,
    .app-rail-item .et-match-card {
      display: grid;
      block-size: 100%;
    }
  `,
})
export class SportRecipesMatchRailExampleComponent {
  public matches = RAIL_MATCHES;
}
