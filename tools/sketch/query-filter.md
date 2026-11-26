```html
<et-query-filter [queryForm]="myQueryForm">
  <ng-template etQueryFilterFor="team">
    <et-team-filter-thingy [formField]="myQueryForm.controls.team" />
  </ng-template>

  <ng-template etQueryFilterFor="player">
    <et-player-filter-thingy [formField]="myQueryForm.controls.player" />
  </ng-template>

  <ng-template etQueryFilterFor="competitionFilter">
    <et-connected-competition-filter-thingy [formField]="myQueryForm.controls.competitionFilter" />
  </ng-template>

  <button (click)="addFilter()">Add Filter</button>

  <ng-template #filterMenuTpl>
    <et-menu etQueryFilterOptionsMenu>
      <filter-option etQueryFilterOptionFor="team" />
    </et-menu>
  </ng-template>
</et-query-filter>
```
