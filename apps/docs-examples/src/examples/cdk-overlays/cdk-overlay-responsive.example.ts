import { Component, ViewEncapsulation } from '@angular/core';
import {
  OverlayImports,
  injectOverlayManager,
  transformingBottomSheetToDialogOverlayStrategy,
  transformingFullScreenDialogToRightSheetOverlayStrategy,
} from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-overlay-responsive-content',
  template: `
    <div etOverlayHeader>
      <h2 etOverlayTitle>Responsive overlay</h2>
    </div>

    <et-overlay-body dividers="dynamic">
      <p>Resize the window while this is open. It transforms in place instead of closing and reopening.</p>
    </et-overlay-body>

    <div etOverlayFooter>
      <button etOverlayClose type="button">Close</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayImports],
})
export class CdkOverlayResponsiveContentComponent {}

@Component({
  selector: 'app-cdk-overlay-responsive-example',
  template: `
    <button (click)="openBottomSheetToDialog()" type="button">Bottom sheet to dialog</button>
    <button (click)="openFullScreenToRightSheet()" type="button">Full screen to right sheet</button>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class CdkOverlayResponsiveExampleComponent {
  private manager = injectOverlayManager();

  protected openBottomSheetToDialog() {
    this.manager.open(CdkOverlayResponsiveContentComponent, {
      strategies: transformingBottomSheetToDialogOverlayStrategy({ breakpoint: 'md' }),
    });
  }

  protected openFullScreenToRightSheet() {
    this.manager.open(CdkOverlayResponsiveContentComponent, {
      strategies: transformingFullScreenDialogToRightSheetOverlayStrategy(),
    });
  }
}
