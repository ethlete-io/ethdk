```html
<button etMenuTriggerFor="menuTpl">Open Menu</button>

<ng-template #menuTpl>
  <et-menu>
    <ng-template etMenuSearch>
      <et-form-field>
        <et-label>Search</et-label>
        <et-search-input />
      </et-form-field>
    </ng-template>

    <p etMenuItem>Lorem, ipsum dolor.</p>
    <p etMenuItem>Lorem, ipsum dolor.</p>
    <p etMenuItem>Lorem, ipsum dolor.</p>
  </et-menu>
</ng-template>
```
