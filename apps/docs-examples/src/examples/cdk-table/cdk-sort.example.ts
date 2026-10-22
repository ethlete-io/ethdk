import { Component, ViewEncapsulation } from '@angular/core';
import { SortImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-sort-example',
  template: `
    <div etSort etSortStart="desc">
      <p et-sort-header sortActionDescription="Sort by name">Sort header</p>
    </div>

    <div etSort>
      <p arrowPosition="before" disableClear et-sort-header>Arrow before, no cleared state</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SortImports],
})
export class CdkSortExampleComponent {}
