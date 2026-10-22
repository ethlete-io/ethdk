import { Component, ViewEncapsulation } from '@angular/core';
import { CheckboxImports, InputImports, MenuImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-menu-default-example',
  template: `
    <button [etMenuTrigger]="menuTpl" type="button">Actions</button>

    <ng-template #menuTpl>
      <et-menu>
        <ng-template etMenuSearchTemplate>
          <et-input-field>
            <et-label>Search</et-label>
            <et-search-input />
          </et-input-field>
        </ng-template>

        <button etMenuItem type="button">Edit</button>
        <button etMenuItem type="button">Duplicate</button>
        <button etMenuItemDisabled etMenuItem type="button">Delete</button>

        <div etMenuGroup>
          <span etMenuGroupTitle>Group title</span>
          <button etMenuItem type="button">Archive</button>
          <button etMenuItem type="button">Move</button>
        </div>

        <div etMenuCheckboxGroup>
          <span etMenuGroupTitle>Columns</span>
          <et-menu-checkbox-item etCheckboxGroupControl>All</et-menu-checkbox-item>
          <et-menu-checkbox-item>Name</et-menu-checkbox-item>
          <et-menu-checkbox-item>Date</et-menu-checkbox-item>
        </div>

        <div etMenuRadioGroup>
          <span etMenuGroupTitle>Sort by</span>
          <et-menu-radio-item value="name">Name</et-menu-radio-item>
          <et-menu-radio-item value="date">Date</et-menu-radio-item>
        </div>
      </et-menu>
    </ng-template>

    <div #toolbar>
      <button
        [etMenuTrigger]="alignedMenuTpl"
        [referenceElement]="toolbar"
        [offset]="{ mainAxis: 5 }"
        mirrorWidth
        placement="bottom-start"
        type="button"
      >
        File
      </button>
      <button
        [etMenuTrigger]="alignedMenuTpl"
        [referenceElement]="toolbar"
        [offset]="{ mainAxis: 5 }"
        mirrorWidth
        placement="bottom-end"
        type="button"
      >
        View
      </button>
    </div>

    <ng-template #alignedMenuTpl>
      <et-menu>
        <button etMenuItem type="button">Open</button>
        <button etMenuItem type="button">Save</button>
      </et-menu>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MenuImports, InputImports, CheckboxImports],
})
export class CdkMenuDefaultExampleComponent {}
