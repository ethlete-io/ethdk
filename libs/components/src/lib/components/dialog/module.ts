import { DialogModule as CdkDialogModule } from '@angular/cdk/dialog';
import { OverlayModule } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { NgModule } from '@angular/core';
import { DIALOG_SCROLL_STRATEGY_PROVIDER, DialogService } from './dialog';
import { DialogContainerComponent } from './dialog-container';
import { DialogCloseDirective, DialogTitleDirective } from './dialog-content-directives';

@NgModule({
  imports: [CdkDialogModule, OverlayModule, PortalModule],
  exports: [DialogContainerComponent, DialogCloseDirective, DialogTitleDirective],
  declarations: [DialogContainerComponent, DialogCloseDirective, DialogTitleDirective],
  providers: [DialogService, DIALOG_SCROLL_STRATEGY_PROVIDER],
})
export class DialogModule {}
