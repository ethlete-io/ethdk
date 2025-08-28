import { Component, inject, Injectable, Injector, ViewContainerRef, ViewEncapsulation } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { OverlayImports } from '../../overlay.imports';
import { OverlayService } from '../../services';
import { provideFilterOverlayConfig, provideOverlayRouterConfig, provideSidebarOverlayConfig } from '../../utils';
import {
  NewOverlayAnchoredDialogStorybookComponent,
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
    <button (click)="topSheet()" type="button">Top sheet</button> <br />
    <button (click)="bottomSheet()" type="button">Bottom sheet</button> <br />
    <button (click)="leftSheet()" type="button">Left sheet</button> <br />
    <button (click)="rightSheet()" type="button">Right sheet</button> <br />
    <button (click)="fullScreenDialog($event)" type="button">Full screen dialog</button> <br />
    <button (click)="dialog()" type="button">Dialog</button> <br />
    <button (click)="transformingBottomSheetToDialog()" type="button">Transforming bottom sheet to dialog</button>
    <br />
    <br />
    <button (click)="anchoredDialog($event)" style="margin-left:300px" type="button">Anchored Dialog</button> <br />
    <br />
    <br />

    <button (click)="dialogWithRouting()" type="button">Dialog with routing</button> <br />
    <br />
    <button (click)="dialogWithRoutingAndSidebar($event)" type="button">Dialog with sidebar</button> <br />
    <br />

    <br />
    <button (click)="toggleScrollable()" type="button">Toggle scrollable</button> <br />

    <br /><br />

    <button (click)="dialogWithInjector()" type="button">Dialog with injector</button> <br />
    <button (click)="dialogWithViewContainerRef()" type="button">Dialog with view container ref</button> <br />

    <br /><br />

    <button (click)="oldSchoolDialog()" type="button">Old school dialog</button> <br />
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
  `,
})
export class OverlayHostStorybookComponent {
  private readonly _overlayService = inject(OverlayService);

  private readonly _vcr = inject(ViewContainerRef);
  private readonly _injector = inject(Injector);

  _isScrollable = false;

  toggleScrollable() {
    this._isScrollable = !this._isScrollable;
  }

  oldSchoolDialog() {
    this._overlayService.open(NewOverlayOldSchoolDialogStorybookComponent, {
      positions: this._overlayService.positions.dialog({}),
    });
  }

  topSheet() {
    this._overlayService.open(OverlayStorybookComponent, {
      positions: this._overlayService.positions.topSheet({}),
    });
  }

  bottomSheet() {
    this._overlayService.open(OverlayStorybookComponent, {
      positions: this._overlayService.positions.bottomSheet({}),
    });
  }

  leftSheet() {
    const ref = this._overlayService.open(OverlayStorybookComponent, {
      positions: this._overlayService.positions.leftSheet({}),
    });

    ref.beforeClosed().subscribe(() => {
      this.rightSheet();
    });
  }

  rightSheet() {
    this._overlayService.open(OverlayStorybookComponent, {
      positions: this._overlayService.positions.rightSheet({}),
    });
  }

  fullScreenDialog(event: MouseEvent | TouchEvent) {
    this._overlayService.open(OverlayStorybookComponent, {
      origin: event,
      positions: this._overlayService.positions.fullScreenDialog({}),
    });
  }

  dialog() {
    this._overlayService.open(OverlayStorybookComponent, {
      positions: this._overlayService.positions.dialog({}),
    });
  }

  anchoredDialog(event: MouseEvent | TouchEvent) {
    this._overlayService.open(NewOverlayAnchoredDialogStorybookComponent, {
      origin: event,
      positions: this._overlayService.positions.anchoredDialog({}),
    });
  }

  dialogWithViewContainerRef() {
    this._overlayService.open(OverlayStorybookComponent, {
      viewContainerRef: this._vcr,
      positions: this._overlayService.positions.dialog({}),
    });
  }

  dialogWithInjector() {
    this._overlayService.open(OverlayStorybookComponent, {
      injector: this._injector,
      positions: this._overlayService.positions.dialog({}),
    });
  }

  transformingBottomSheetToDialog() {
    this._overlayService.open(OverlayStorybookComponent, {
      positions: this._overlayService.positions.transformingBottomSheetToDialog({}),
    });
  }

  dialogWithRouting() {
    this._overlayService.open(NewOverlayStorybookComponent, {
      positions: this._overlayService.positions.dialog({}),
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

  dialogWithRoutingAndSidebar(event: MouseEvent | TouchEvent) {
    this._overlayService.open(NewOverlayWithNavStorybookComponent, {
      positions: this._overlayService.positions.transformingFullScreenDialogToDialog({
        dialog: { width: '550px', height: '500px' },
      }),
      origin: event,
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
