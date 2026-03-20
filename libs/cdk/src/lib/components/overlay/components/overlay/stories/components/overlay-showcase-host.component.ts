import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { injectOverlayManager } from '../../overlay-manager';
import {
  anchoredDialogOverlayStrategy,
  bottomSheetOverlayStrategy,
  dialogOverlayStrategy,
  fullScreenDialogOverlayStrategy,
  injectAnchoredDialogStrategy,
  injectBottomSheetStrategy,
  injectDialogStrategy,
  injectFullscreenDialogStrategy,
  injectLeftSheetStrategy,
  injectRightSheetStrategy,
  injectTopSheetStrategy,
  leftSheetOverlayStrategy,
  rightSheetOverlayStrategy,
  topSheetOverlayStrategy,
  transformingBottomSheetToDialogOverlayStrategy,
  transformingFullScreenDialogToDialogOverlayStrategy,
  transformingFullScreenDialogToRightSheetOverlayStrategy,
} from '../../strategies';
import { OverlaySimpleContentComponent } from './overlay-shared-content.component';
import { STORY_HOST_STYLES } from './story-styles';

@Component({
  selector: 'et-sb-overlay-showcase-host',
  template: `
    <div class="et-sb-host">
      <h2 class="et-sb-heading">Overlay Strategies</h2>
      <p class="et-sb-subheading">Each built-in positioning strategy, click any card to open the overlay.</p>

      <div class="et-sb-card-grid">
        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Dialog</h3>
          <p class="et-sb-card-text">Centered modal. Classic pattern for confirmations and forms.</p>
          <button (click)="openDialog()" class="et-sb-btn" type="button">Open</button>
        </div>

        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Bottom Sheet</h3>
          <p class="et-sb-card-text">Slides up from the bottom. Common on mobile for action menus.</p>
          <button (click)="openBottomSheet()" class="et-sb-btn" type="button">Open</button>
        </div>

        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Top Sheet</h3>
          <p class="et-sb-card-text">Slides down from the top. Suits notifications and banners.</p>
          <button (click)="openTopSheet()" class="et-sb-btn" type="button">Open</button>
        </div>

        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Left Sheet</h3>
          <p class="et-sb-card-text">Slides in from the left. Typically used for navigation drawers.</p>
          <button (click)="openLeftSheet()" class="et-sb-btn" type="button">Open</button>
        </div>

        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Right Sheet</h3>
          <p class="et-sb-card-text">Slides in from the right. Great for detail panels and settings.</p>
          <button (click)="openRightSheet()" class="et-sb-btn" type="button">Open</button>
        </div>

        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Full Screen</h3>
          <p class="et-sb-card-text">Fills the entire viewport. Ideal for immersive interfaces.</p>
          <button (click)="openFullScreen()" class="et-sb-btn" type="button">Open</button>
        </div>

        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Anchored Dialog</h3>
          <p class="et-sb-card-text">Positioned next to the trigger element using connected overlay positioning.</p>
          <button (click)="openAnchoredDialog($event)" class="et-sb-btn" type="button">Open</button>
        </div>
      </div>

      <div class="et-sb-divider"></div>

      <h2 class="et-sb-heading">Responsive Strategies</h2>
      <p class="et-sb-subheading">
        Strategies can be composed with breakpoints so the overlay morphs as the viewport changes. Resize the window
        after opening to see the transitions live.
      </p>

      <div class="et-sb-card-grid">
        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Bottom Sheet → Dialog</h3>
          <p class="et-sb-card-text">Bottom sheet on narrow viewports, dialog above the configured breakpoint.</p>
          <button (click)="openBottomSheetToDialog()" class="et-sb-btn" type="button">Open</button>
        </div>

        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Full Screen → Dialog</h3>
          <p class="et-sb-card-text">Full screen on mobile, switches to a centered dialog on wider screens.</p>
          <button (click)="openFullScreenToDialog()" class="et-sb-btn" type="button">Open</button>
        </div>

        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Full Screen → Right Sheet</h3>
          <p class="et-sb-card-text">Full screen on mobile, right-side panel on wider screens.</p>
          <button (click)="openFullScreenToRightSheet()" class="et-sb-btn" type="button">Open</button>
        </div>

        <div class="et-sb-card">
          <h3 class="et-sb-card-title">All Strategies</h3>
          <p class="et-sb-card-text">
            All seven strategies wired to consecutive breakpoints. Each 100 px step switches to the next strategy.
          </p>
          <button (click)="openAllStrategies()" class="et-sb-btn" type="button">Open</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    STORY_HOST_STYLES,
    `
      .et-sb-divider {
        border: none;
        border-top: 1px solid #27272a;
        margin: 2rem 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class OverlayShowcaseHostComponent {
  private readonly _manager = injectOverlayManager();

  openDialog() {
    this._manager.open(OverlaySimpleContentComponent, {
      strategies: dialogOverlayStrategy(),
      data: { title: 'Dialog' },
    });
  }

  openBottomSheet() {
    this._manager.open(OverlaySimpleContentComponent, {
      strategies: bottomSheetOverlayStrategy(),
      data: { title: 'Bottom Sheet' },
    });
  }

  openTopSheet() {
    this._manager.open(OverlaySimpleContentComponent, {
      strategies: topSheetOverlayStrategy(),
      data: { title: 'Top Sheet' },
    });
  }

  openLeftSheet() {
    this._manager.open(OverlaySimpleContentComponent, {
      strategies: leftSheetOverlayStrategy(),
      data: { title: 'Left Sheet' },
    });
  }

  openRightSheet() {
    this._manager.open(OverlaySimpleContentComponent, {
      strategies: rightSheetOverlayStrategy(),
      data: { title: 'Right Sheet' },
    });
  }

  openFullScreen() {
    this._manager.open(OverlaySimpleContentComponent, {
      strategies: fullScreenDialogOverlayStrategy(),
      data: { title: 'Full Screen' },
    });
  }

  openAnchoredDialog(event: MouseEvent) {
    this._manager.open(OverlaySimpleContentComponent, {
      strategies: anchoredDialogOverlayStrategy(),
      origin: event,
      data: { title: 'Anchored Dialog' },
    });
  }

  openBottomSheetToDialog() {
    this._manager.open(OverlaySimpleContentComponent, {
      strategies: transformingBottomSheetToDialogOverlayStrategy(),
      data: { title: 'Responsive Overlay', description: 'Bottom sheet below breakpoint, dialog above.' },
    });
  }

  openFullScreenToDialog() {
    this._manager.open(OverlaySimpleContentComponent, {
      strategies: transformingFullScreenDialogToDialogOverlayStrategy(),
      data: { title: 'Responsive Overlay', description: 'Full screen below breakpoint, dialog above.' },
    });
  }

  openFullScreenToRightSheet() {
    this._manager.open(OverlaySimpleContentComponent, {
      strategies: transformingFullScreenDialogToRightSheetOverlayStrategy(),
      data: { title: 'Responsive Overlay', description: 'Full screen below breakpoint, right sheet above.' },
    });
  }

  openAllStrategies() {
    this._manager.open(OverlaySimpleContentComponent, {
      strategies: () => {
        const fullscreen = injectFullscreenDialogStrategy();
        const bottomSheet = injectBottomSheetStrategy();
        const leftSheet = injectLeftSheetStrategy();
        const rightSheet = injectRightSheetStrategy();
        const topSheet = injectTopSheetStrategy();
        const anchored = injectAnchoredDialogStrategy();
        const dialog = injectDialogStrategy();

        return [
          { strategy: fullscreen.build() },
          { breakpoint: 700, strategy: bottomSheet.build() },
          { breakpoint: 800, strategy: leftSheet.build() },
          { breakpoint: 900, strategy: rightSheet.build() },
          { breakpoint: 1000, strategy: topSheet.build() },
          { breakpoint: 1100, strategy: anchored.build() },
          { breakpoint: 1200, strategy: dialog.build() },
        ];
      },
      data: { title: 'All Strategies', description: 'Resize the window to cycle through all seven strategies.' },
    });
  }
}
