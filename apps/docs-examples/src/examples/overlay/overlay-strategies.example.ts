import { Component, ViewEncapsulation } from '@angular/core';
import {
  anchoredDialogOverlayStrategy,
  BUTTON_IMPORTS,
  bottomSheetOverlayStrategy,
  dialogOverlayStrategy,
  fullScreenDialogOverlayStrategy,
  injectOverlayManager,
  leftSheetOverlayStrategy,
  OVERLAY_CONTENT_IMPORTS,
  OverlayConfig,
  rightSheetOverlayStrategy,
  topSheetOverlayStrategy,
  transformingBottomSheetToDialogOverlayStrategy,
  transformingFullScreenDialogToDialogOverlayStrategy,
} from '@ethlete/components';

@Component({
  selector: 'app-overlay-strategies-content',
  template: `
    <div etOverlayMain>
      <div etOverlayHeader>
        <h2 et-overlay-title>Example overlay</h2>
      </div>

      <div dividers="dynamic" et-overlay-body>
        @for (paragraph of PARAGRAPHS; track $index) {
          <p>{{ paragraph }}</p>
        }
      </div>

      <div etOverlayFooter>
        <button et-button etOverlayClose size="sm" variant="outline">Cancel</button>
        <button et-button etOverlayClose="confirmed" size="sm">Confirm</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS],
})
export class OverlayStrategiesContentComponent {
  protected readonly PARAGRAPHS = [
    'The overlay body scrolls independently while the header and footer stay pinned in place.',
    'Dialogs are capped at 80% of the viewport height by default, so long content scrolls instead of growing past the screen.',
    'The divider lines above and below the body only appear once the content behind them is scrolled out of view.',
    'Resize the viewport while a transforming overlay is open to watch it switch strategies without remounting its content.',
    'Sheets can be dragged past their edge; the pane visually extends so no gap appears while over-dragging.',
    'Focus is trapped inside the overlay while it is open and restored to the trigger once it closes.',
    'Pressing Escape or clicking the backdrop closes the overlay unless closing is explicitly disabled.',
  ];
}

@Component({
  selector: 'app-overlay-strategies-example',
  template: `
    <h3>Dialogs</h3>
    <div class="app-example-row">
      <button (click)="open({ strategies: dialog() })" et-button size="sm">Dialog</button>
      <button (click)="open({ strategies: anchoredDialog(), origin: $event })" et-button size="sm" variant="tonal">
        Anchored dialog
      </button>
      <button (click)="open({ strategies: fullScreen(), origin: $event })" et-button size="sm" variant="outline">
        Full-screen dialog
      </button>
    </div>

    <h3>Sheets (drag to dismiss)</h3>
    <div class="app-example-row">
      <button (click)="open({ strategies: bottomSheet() })" et-button size="sm">Bottom sheet</button>
      <button (click)="open({ strategies: topSheet() })" et-button size="sm">Top sheet</button>
      <button (click)="open({ strategies: leftSheet() })" et-button size="sm">Left sheet</button>
      <button (click)="open({ strategies: rightSheet() })" et-button size="sm">Right sheet</button>
      <button (click)="open({ strategies: snappingBottomSheet() })" et-button size="sm" variant="tonal">
        Bottom sheet (snap points)
      </button>
    </div>

    <h3>Transforming (resize while open)</h3>
    <div class="app-example-row">
      <button (click)="open({ strategies: bottomSheetToDialog() })" et-button size="sm">Bottom sheet to dialog</button>
      <button (click)="open({ strategies: fullScreenToDialog(), origin: $event })" et-button size="sm">
        Full-screen to dialog
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class OverlayStrategiesExampleComponent {
  private overlayManager = injectOverlayManager();

  protected dialog() {
    return dialogOverlayStrategy();
  }

  protected anchoredDialog() {
    return anchoredDialogOverlayStrategy({ minWidth: 500 });
  }

  protected fullScreen() {
    return fullScreenDialogOverlayStrategy();
  }

  protected bottomSheet() {
    return bottomSheetOverlayStrategy();
  }

  protected topSheet() {
    return topSheetOverlayStrategy();
  }

  protected leftSheet() {
    return leftSheetOverlayStrategy();
  }

  protected rightSheet() {
    return rightSheetOverlayStrategy();
  }

  protected snappingBottomSheet() {
    return bottomSheetOverlayStrategy({ dragToDismiss: { direction: 'to-bottom', snapPoints: [0, 0.4, 0.7] } });
  }

  protected bottomSheetToDialog() {
    return transformingBottomSheetToDialogOverlayStrategy({ breakpoint: 'md' });
  }

  protected fullScreenToDialog() {
    return transformingFullScreenDialogToDialogOverlayStrategy({ breakpoint: 'md' });
  }

  protected open(config: OverlayConfig) {
    this.overlayManager.open(OverlayStrategiesContentComponent, config);
  }
}
