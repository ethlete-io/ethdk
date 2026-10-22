import { Component, ViewEncapsulation } from '@angular/core';
import { LOADER_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-loader-spinner-themed-example',
  template: `
    <et-spinner />
    <et-spinner color="danger" />
    <et-spinner [value]="65" color="success" />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [LOADER_IMPORTS],
})
export class LoaderSpinnerThemedExampleComponent {}
