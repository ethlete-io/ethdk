import { Component, ViewEncapsulation } from '@angular/core';
import { LOADER_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-loader-spinner-determinate-example',
  template: `
    <et-spinner [value]="65" />
    <et-spinner [value]="100" />
    <et-spinner [value]="65" track="false" />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [LOADER_IMPORTS],
})
export class LoaderSpinnerDeterminateExampleComponent {}
