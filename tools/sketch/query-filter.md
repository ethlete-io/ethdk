```html
<dyn-query-filter [queryForm]="myQueryForm">
  <ng-template dynQueryFilterFor="team">
    <dyn-team-filter-thingy [formField]="myQueryForm.controls.team" />
  </ng-template>

  <ng-template dynQueryFilterFor="player">
    <dyn-player-filter-thingy [formField]="myQueryForm.controls.player" />
  </ng-template>

  <button (click)="addFilter()">Add Filter</button>

  <ng-template #filterMenuTpl>
    <et-menu dynQueryFilterOptionsMenu>
      <filter-option dynQueryFilterOptionFor="team" />
    </et-menu>
  </ng-template>
</dyn-query-filter>
```
