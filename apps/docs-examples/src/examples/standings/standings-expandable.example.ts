import { Component, signal, ViewEncapsulation } from '@angular/core';
import { STANDINGS_IMPORTS, TextButtonComponent } from '@ethlete/components';
import { SEASONS, STANDINGS_ROWS } from './standings-expandable.data';

@Component({
  selector: 'app-standings-expandable-example',
  template: `
    <et-standings [(expandedRows)]="expandedRows" [rows]="rows">
      <ng-template let-row etStandingsRowDetail>
        @for (season of seasons[row.id]; track season.name) {
          <tr class="et-standings-row">
            <td class="et-standings-cell" data-column="position"></td>
            <td class="et-standings-cell" data-column="participant">
              <button (click)="openedSeason.set(season.name)" et-text-button type="button">{{ season.name }}</button>
            </td>
            <td class="et-standings-cell" data-column="detail">{{ season.played }}</td>
            <td class="et-standings-cell" data-column="detail">{{ season.wins }}</td>
            <td class="et-standings-cell" data-column="detail">{{ season.ties }}</td>
            <td class="et-standings-cell" data-column="detail">{{ season.losses }}</td>
            <td class="et-standings-cell" data-column="points">{{ season.points }}</td>
            <td class="et-standings-cell" data-column="expand"></td>
          </tr>
        }
      </ng-template>
    </et-standings>
    <p>Open: {{ expandedRows().join(', ') || 'none' }} · Last season clicked: {{ openedSeason() ?? 'none' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STANDINGS_IMPORTS, TextButtonComponent],
})
export class StandingsExpandableExampleComponent {
  public rows = STANDINGS_ROWS;
  public seasons = SEASONS;
  public expandedRows = signal<readonly string[]>(['fcb']);
  public openedSeason = signal<string | null>(null);
}
