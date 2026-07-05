import { Component, inject, Injectable, Injector, ViewContainerRef, ViewEncapsulation } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { provideFilterOverlayConfig } from '../../filter-overlay';
import { injectOverlayManager } from '../../overlay-manager';
import { OverlayImports } from '../../overlay.imports';
import { provideOverlayRouterConfig } from '../../routing';
import { provideSidebarOverlayConfig } from '../../sidebar';
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
import {
  NewOverlayAnchoredDialogStorybookComponent,
  NewOverlayNestedMainDialogStorybookComponent,
  NewOverlayOldSchoolDialogStorybookComponent,
  NewOverlayStorybookComponent,
  NewOverlaySubRoute1StorybookComponent,
  NewOverlaySubRoute2StorybookComponent,
  NewOverlaySubRoute3StorybookComponent,
  NewOverlaySubRoute4StorybookComponent,
  NewOverlaySubRoute5StorybookComponent,
  NewOverlaySubRoute6StorybookComponent,
  NewOverlayWithNavStorybookComponent,
  OverlayStorybookComponent,
} from './overlay.storybook.component';

@Injectable()
export class StorybookExampleService {}

@Component({
  selector: 'et-sb-overlay-host',
  template: `
    <button (click)="ovmTopSheet()" type="button">Top sheet</button> <br />
    <button (click)="ovmBottomSheet()" type="button">Bottom sheet</button> <br />
    <button (click)="ovmLeftSheet()" type="button">Left sheet</button> <br />
    <button (click)="ovmRightSheet()" type="button">Right sheet</button> <br />
    <button (click)="ovmFullScreen()" class="fancy-button" type="button">Full screen dialog</button> <br />
    <button (click)="ovmDialog()" type="button">Dialog</button> <br />
    <button (click)="transformingBottomSheetToDialog()" type="button">Transforming bottom sheet to dialog</button>
    <br />

    <button (click)="transformingFullScreenDialogToDialog()" type="button">
      Transforming full screen dialog to dialog
    </button>
    <br />

    <button (click)="transformingFullScreenDialogToRightSheet()" type="button">
      Transforming full screen dialog to right sheet
    </button>
    <br />
    <br />
    <button (click)="ovmAnchoredDialog()" style="margin-left:300px" type="button">Anchored Dialog</button> <br />
    <br />
    <br />

    <button (click)="dialogWithRouting()" type="button">Dialog with routing</button> <br />
    <br />
    <button (click)="dialogWithRoutingAndSidebar()" type="button">Dialog with sidebar</button> <br />
    <br />

    <br />
    <button (click)="toggleScrollable()" type="button">Toggle scrollable</button> <br />

    <br /><br />

    <button (click)="dialogWithInjector()" type="button">Dialog with injector</button> <br />
    <button (click)="dialogWithViewContainerRef()" type="button">Dialog with view container ref</button> <br />

    <br /><br />

    <button (click)="dialogNestedMain()" type="button">Nested main dialog</button> <br />

    <br /><br />

    <button (click)="oldSchoolDialog()" type="button">Old school dialog</button> <br />

    <br /><br />
    <br /><br />

    <button (click)="ovmTransformerMax()" class="fancy-button" type="button">All in one</button>
    <br />

    <div style="height: 20rem"></div>

    @if (_isScrollable) {
      <div style="background:#171717; height:200vh; margin-top: 2rem"></div>
    }
  `,
  imports: [OverlayImports],
  encapsulation: ViewEncapsulation.None,
  styles: `
    .et-bottom-sheet,
    .et-overlay,
    .et-dialog {
      background-color: #282828;
      color: #fff;
      font-family: Arial, Helvetica, sans-serif;
    }

    .et-dialog,
    .et-overlay--dialog,
    .et-overlay--anchored-dialog {
      border-radius: 20px;
    }

    .et-bottom-sheet,
    .et-overlay--bottom-sheet {
      border-radius: 20px 20px 0 0;
    }

    .et-overlay--top-sheet {
      border-radius: 0 0 20px 20px;
    }

    .et-overlay--right-sheet {
      border-radius: 20px 0 0 20px;
    }

    .et-overlay--left-sheet {
      border-radius: 0 20px 20px 0;
    }

    .et-bottom-sheet-drag-handle {
      --background-color: #fff;
    }

    .fancy-button {
      background-color: #ff4081;
      border: none;
      border-radius: 8px;
      color: white;
      padding: 10px 20px;
      text-align: center;
      text-decoration: none;
      display: inline-block;
      font-size: 16px;
      margin: 4px 2px;
      cursor: pointer;
      box-shadow: 0 4px #d93670;
      transition: all 0.2s;
      outline: none;
    }

    .fancy-button:hover {
      background-color: #e73370;
      box-shadow: 0 6px #d93670;
      transform: translateY(-2px);
    }

    .fancy-button:active {
      box-shadow: 0 2px #d93670;
      transform: translateY(2px);
    }
  `,
})
export class OverlayHostStorybookComponent {
  private vcr = inject(ViewContainerRef);
  private injector = inject(Injector);
  private overlayManager = injectOverlayManager();

  _isScrollable = false;

  ovmDialog() {
    this.overlayManager.open(OverlayStorybookComponent, {
      strategies: dialogOverlayStrategy(),
    });
  }

  ovmBottomSheet() {
    this.overlayManager.open(OverlayStorybookComponent, {
      strategies: bottomSheetOverlayStrategy(),
    });
  }

  ovmTopSheet() {
    this.overlayManager.open(OverlayStorybookComponent, {
      strategies: topSheetOverlayStrategy(),
    });
  }

  ovmLeftSheet() {
    this.overlayManager.open(OverlayStorybookComponent, {
      strategies: leftSheetOverlayStrategy(),
    });
  }

  ovmRightSheet() {
    this.overlayManager.open(OverlayStorybookComponent, {
      strategies: rightSheetOverlayStrategy(),
    });
  }

  ovmFullScreen() {
    this.overlayManager.open(OverlayStorybookComponent, {
      strategies: fullScreenDialogOverlayStrategy(),
    });
  }

  ovmAnchoredDialog() {
    this.overlayManager.open(NewOverlayAnchoredDialogStorybookComponent, {
      strategies: anchoredDialogOverlayStrategy(),
    });
  }

  ovmTransformerMax() {
    this.overlayManager.open(OverlayStorybookComponent, {
      strategies: () => {
        const fullscreenDialogStrategyProvider = injectFullscreenDialogStrategy();
        const dialogStrategy = injectDialogStrategy();
        const bottomSheetStrategy = injectBottomSheetStrategy();
        const leftSheetStrategy = injectLeftSheetStrategy();
        const rightSheetStrategy = injectRightSheetStrategy();
        const topSheetStrategy = injectTopSheetStrategy();
        const anchoredDialogStrategy = injectAnchoredDialogStrategy();

        return [
          {
            strategy: fullscreenDialogStrategyProvider.build(),
          },
          {
            breakpoint: 700,
            strategy: bottomSheetStrategy.build(),
          },
          {
            breakpoint: 800,
            strategy: leftSheetStrategy.build(),
          },
          {
            breakpoint: 900,
            strategy: rightSheetStrategy.build(),
          },
          {
            breakpoint: 1000,
            strategy: topSheetStrategy.build(),
          },
          {
            breakpoint: 1100,
            strategy: anchoredDialogStrategy.build(),
          },
          {
            breakpoint: 1200,
            strategy: dialogStrategy.build(),
          },
        ];
      },
    });
  }

  toggleScrollable() {
    this._isScrollable = !this._isScrollable;
  }

  oldSchoolDialog() {
    this.overlayManager.open(NewOverlayOldSchoolDialogStorybookComponent, {
      strategies: dialogOverlayStrategy(),
    });
  }

  dialogNestedMain() {
    this.overlayManager.open(NewOverlayNestedMainDialogStorybookComponent, {
      strategies: dialogOverlayStrategy(),
    });
  }

  dialogWithViewContainerRef() {
    this.overlayManager.open(OverlayStorybookComponent, {
      strategies: dialogOverlayStrategy(),
      viewContainerRef: this.vcr,
    });
  }

  dialogWithInjector() {
    this.overlayManager.open(OverlayStorybookComponent, {
      strategies: dialogOverlayStrategy(),
      injector: this.injector,
    });
  }

  transformingBottomSheetToDialog() {
    this.overlayManager.open(OverlayStorybookComponent, {
      strategies: transformingBottomSheetToDialogOverlayStrategy(),
      injector: this.injector,
    });
  }

  transformingFullScreenDialogToDialog() {
    this.overlayManager.open(OverlayStorybookComponent, {
      strategies: transformingFullScreenDialogToDialogOverlayStrategy(),
      injector: this.injector,
    });
  }

  transformingFullScreenDialogToRightSheet() {
    this.overlayManager.open(OverlayStorybookComponent, {
      strategies: transformingFullScreenDialogToRightSheetOverlayStrategy(),
      injector: this.injector,
    });
  }

  dialogWithRouting() {
    this.overlayManager.open(NewOverlayStorybookComponent, {
      strategies: dialogOverlayStrategy(),
      providers: [
        provideOverlayRouterConfig({
          routes: [
            {
              path: '/',
              component: NewOverlaySubRoute1StorybookComponent,
            },
            {
              path: '/sub-route',
              component: NewOverlaySubRoute2StorybookComponent,
            },
            {
              path: '/sub-route-2',
              component: NewOverlaySubRoute3StorybookComponent,
            },
          ],
        }),
        provideFilterOverlayConfig({ form: new FormGroup({}) }),
      ],
    });
  }

  dialogWithRoutingAndSidebar() {
    this.overlayManager.open(NewOverlayWithNavStorybookComponent, {
      strategies: transformingFullScreenDialogToDialogOverlayStrategy({
        dialog: { width: '550px', height: '500px' },
      }),
      providers: [
        provideOverlayRouterConfig({
          routes: [
            {
              path: '/',
              component: NewOverlaySubRoute4StorybookComponent,
            },
            {
              path: '/sub-route',
              component: NewOverlaySubRoute5StorybookComponent,
            },
            {
              path: '/sub-route-2',
              component: NewOverlaySubRoute6StorybookComponent,
            },
          ],
        }),
        provideSidebarOverlayConfig({}),
      ],
    });
  }
}
