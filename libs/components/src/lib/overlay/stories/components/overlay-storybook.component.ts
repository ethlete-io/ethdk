import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { Breakpoint } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../../button';
import { OverlayConfig } from '../../overlay-config';
import { injectOverlayManager } from '../../overlay-manager';
import { OVERLAY_CONTENT_IMPORTS } from '../../overlay.imports';
import {
  anchoredDialogOverlayStrategy,
  bottomSheetOverlayStrategy,
  dialogOverlayStrategy,
  fullScreenDialogOverlayStrategy,
  leftSheetOverlayStrategy,
  rightSheetOverlayStrategy,
  topSheetOverlayStrategy,
  transformingBottomSheetToDialogOverlayStrategy,
  transformingFullScreenDialogToDialogOverlayStrategy,
  transformingFullScreenDialogToRightSheetOverlayStrategy,
} from '../../strategies';

@Component({
  selector: 'et-sb-overlay-example',
  template: `
    <div etOverlayMain>
      <div etOverlayHeader>
        <h2 class="text-h6 font-title" et-overlay-title>Example overlay</h2>
      </div>

      <div dividers="dynamic" et-overlay-body>
        <div class="flex max-w-md flex-col gap-4">
          @for (paragraph of paragraphs; track $index) {
            <p>{{ paragraph }}</p>
          }
        </div>
      </div>

      <div class="flex justify-end gap-3" etOverlayFooter>
        <button et-button etOverlayClose size="sm" variant="outline">Cancel</button>
        <button et-button etOverlayClose="confirmed" size="sm">Confirm</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS],
})
export class OverlayExampleOverlayComponent {
  protected paragraphs = Array.from(
    { length: 12 },
    (_, index) =>
      `Paragraph ${index + 1}: the overlay body scrolls independently while header and footer stay pinned. Resize the viewport while a transforming overlay is open to watch it switch strategies without remounting.`,
  );
}

@Component({
  selector: 'et-sb-overlay-popover',
  template: `
    <div class="flex min-w-40 flex-col gap-1 p-2">
      <button et-button etOverlayClose size="sm" variant="transparent">Profile</button>
      <button et-button etOverlayClose size="sm" variant="transparent">Settings</button>
      <button et-button etOverlayClose size="sm" variant="transparent">Sign out</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS],
})
export class OverlayPopoverExampleComponent {}

@Component({
  selector: 'et-sb-overlay',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      <header class="flex flex-col gap-1">
        <h2 class="text-h5 font-title">Overlays</h2>
        <p class="text-small text-white/60">Dialogs, sheets and transforming strategies built on the overlay primitives.</p>
      </header>

      <section class="flex flex-col gap-3">
        <h3 class="text-small font-semibold uppercase tracking-widest text-white/50">Dialogs</h3>
        <div class="flex flex-wrap gap-4">
          <button (click)="openDialog()" et-button size="sm">Dialog</button>
          <button (click)="openAnchoredDialog($event)" et-button size="sm" variant="tonal">Anchored dialog</button>
          <button (click)="openAnchoredPopover($event)" et-button size="sm" variant="tonal">Anchored popover (arrow)</button>
          <button (click)="openFullScreen($event)" et-button size="sm" variant="outline">Full-screen dialog</button>
        </div>
      </section>

      <section class="flex flex-col gap-3">
        <h3 class="text-small font-semibold uppercase tracking-widest text-white/50">Sheets (drag to dismiss)</h3>
        <div class="flex flex-wrap gap-4">
          <button (click)="openBottomSheet()" et-button size="sm">Bottom sheet</button>
          <button (click)="openTopSheet()" et-button size="sm">Top sheet</button>
          <button (click)="openLeftSheet()" et-button size="sm">Left sheet</button>
          <button (click)="openRightSheet()" et-button size="sm">Right sheet</button>
        </div>
      </section>

      <section class="flex flex-col gap-3">
        <h3 class="text-small font-semibold uppercase tracking-widest text-white/50">Transforming (resize while open)</h3>
        <div class="flex flex-wrap gap-4">
          <button (click)="openBottomSheetToDialog()" et-button size="sm">Bottom sheet → dialog</button>
          <button (click)="openFullScreenToDialog($event)" et-button size="sm">Full-screen → dialog</button>
          <button (click)="openFullScreenToRightSheet($event)" et-button size="sm">Full-screen → right sheet</button>
        </div>
      </section>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BUTTON_IMPORTS],
  styles: `
    .et-sb-overlay-panel {
      background-color: #1c1c1f;
      color: #fafafa;
    }

    .et-overlay--dialog.et-sb-overlay-panel,
    .et-overlay--anchored-dialog.et-sb-overlay-panel {
      border-radius: 12px;
    }

    .et-overlay--bottom-sheet.et-sb-overlay-panel {
      border-radius: 12px 12px 0 0;
    }

    .et-overlay--top-sheet.et-sb-overlay-panel {
      border-radius: 0 0 12px 12px;
    }
  `,
})
export class OverlayStorybookComponent {
  private overlayManager = injectOverlayManager();
  private readonly TRANSFORM_BREAKPOINT: Breakpoint = 'md';

  protected openDialog() {
    this.open({ strategies: dialogOverlayStrategy() });
  }

  protected openAnchoredDialog(origin: Event) {
    this.open({ strategies: anchoredDialogOverlayStrategy(), origin });
  }

  protected openAnchoredPopover(origin: Event) {
    this.overlayManager.open(OverlayPopoverExampleComponent, {
      strategies: anchoredDialogOverlayStrategy({ placement: 'bottom' }),
      origin,
      panelClass: 'et-sb-overlay-panel',
    });
  }

  protected openFullScreen(origin: Event) {
    this.open({ strategies: fullScreenDialogOverlayStrategy(), origin });
  }

  protected openBottomSheet() {
    this.open({ strategies: bottomSheetOverlayStrategy() });
  }

  protected openTopSheet() {
    this.open({ strategies: topSheetOverlayStrategy() });
  }

  protected openLeftSheet() {
    this.open({ strategies: leftSheetOverlayStrategy() });
  }

  protected openRightSheet() {
    this.open({ strategies: rightSheetOverlayStrategy() });
  }

  protected openBottomSheetToDialog() {
    this.open({
      strategies: transformingBottomSheetToDialogOverlayStrategy({ breakpoint: this.TRANSFORM_BREAKPOINT }),
    });
  }

  protected openFullScreenToDialog(origin: Event) {
    this.open({
      strategies: transformingFullScreenDialogToDialogOverlayStrategy({ breakpoint: this.TRANSFORM_BREAKPOINT }),
      origin,
    });
  }

  protected openFullScreenToRightSheet(origin: Event) {
    this.open({
      strategies: transformingFullScreenDialogToRightSheetOverlayStrategy({ breakpoint: this.TRANSFORM_BREAKPOINT }),
      origin,
    });
  }

  private open(config: OverlayConfig) {
    this.overlayManager.open(OverlayExampleOverlayComponent, {
      ...config,
      panelClass: 'et-sb-overlay-panel',
    });
  }
}
