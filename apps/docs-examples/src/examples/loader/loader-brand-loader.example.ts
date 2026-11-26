import { Component, ViewEncapsulation } from '@angular/core';
import { BrandLoaderComponent } from '@ethlete/components';

@Component({
  selector: 'app-loader-brand-loader-example',
  template: `<et-brand-loader class="example-brand-loader" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [BrandLoaderComponent],
  styles: `
    .example-brand-loader {
      inline-size: 64px;
      block-size: 64px;
    }
  `,
})
export class LoaderBrandLoaderExampleComponent {}
