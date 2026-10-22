import { Component, ViewEncapsulation } from '@angular/core';
import { LOADER_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-loader-progress-bar-example',
  template: `
    <et-progress-bar />
    <et-progress-bar [value]="42" color="brand" />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [LOADER_IMPORTS],
})
export class LoaderProgressBarExampleComponent {}
