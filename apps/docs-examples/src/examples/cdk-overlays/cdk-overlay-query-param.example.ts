import { Component, ViewEncapsulation, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { OverlayImports, createOverlayHandlerWithQueryParamLifecycle, dialogOverlayStrategy } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-overlay-query-param-product',
  template: `
    <div etOverlayHeader>
      <h2 etOverlayTitle>Product {{ overlayQueryParam() }}</h2>
    </div>

    <et-overlay-body>
      <p>This overlay is open because the <code>product</code> query param is present. Removing the param closes it.</p>
    </et-overlay-body>

    <div etOverlayFooter>
      <button etOverlayClose type="button">Close</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayImports],
})
export class CdkOverlayQueryParamProductComponent {
  public overlayQueryParam = input<string>();
}

export const createProductOverlay = createOverlayHandlerWithQueryParamLifecycle<CdkOverlayQueryParamProductComponent>({
  component: CdkOverlayQueryParamProductComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '440px' }),
  queryParamKey: 'product',
});

@Component({
  selector: 'app-cdk-overlay-query-param-example',
  template: `
    <button (click)="open('shoes')" type="button">Open ?product=shoes</button>
    <button (click)="open('jackets')" type="button">Open ?product=jackets</button>
    <button (click)="productOverlay.close()" type="button">Close</button>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class CdkOverlayQueryParamExampleComponent {
  private router = inject(Router);

  protected productOverlay = createProductOverlay();

  protected open(product: string) {
    this.router.navigate([], { queryParams: { product }, queryParamsHandling: 'merge' });
  }
}
