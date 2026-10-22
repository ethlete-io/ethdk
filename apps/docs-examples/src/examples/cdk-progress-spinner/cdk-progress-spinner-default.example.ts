import { Component, ViewEncapsulation } from '@angular/core';
import { ProgressSpinnerComponent } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-progress-spinner-default-example',
  template: `
    <et-spinner [diameter]="48" />

    <et-progress-spinner [value]="65" [diameter]="48" renderBackground />

    <et-spinner [diameter]="48" multiColor />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ProgressSpinnerComponent],
})
export class CdkProgressSpinnerDefaultExampleComponent {}
