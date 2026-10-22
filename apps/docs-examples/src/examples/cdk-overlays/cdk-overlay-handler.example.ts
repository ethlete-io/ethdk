import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { OverlayImports, OverlayRef, createOverlayHandler, dialogOverlayStrategy } from '@ethlete/cdk';

type ProductResult = 'confirmed' | 'dismissed';

@Component({
  selector: 'app-cdk-overlay-handler-product',
  template: `
    <div etOverlayHeader>
      <h2 etOverlayTitle>Product</h2>
    </div>

    <et-overlay-body>
      <p>Choose a result. It flows back to the afterClosed callback as a typed value.</p>
    </et-overlay-body>

    <div etOverlayFooter>
      <button (click)="ref.close('dismissed')" type="button">Dismiss</button>
      <button (click)="ref.close('confirmed')" type="button">Confirm</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayImports],
})
export class CdkOverlayHandlerProductComponent {
  protected ref = inject<OverlayRef<CdkOverlayHandlerProductComponent, ProductResult>>(OverlayRef);
}

export const productOverlayHandler = createOverlayHandler<CdkOverlayHandlerProductComponent, void, ProductResult>({
  component: CdkOverlayHandlerProductComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '440px' }),
});

@Component({
  selector: 'app-cdk-overlay-handler-example',
  template: `
    <button (click)="productOverlay.open()" type="button">Open overlay</button>

    <p>Last result: {{ result() ?? 'none' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class CdkOverlayHandlerExampleComponent {
  protected result = signal<ProductResult | null | undefined>(null);

  protected productOverlay = productOverlayHandler({
    afterClosed: (result) => this.result.set(result),
  });
}
