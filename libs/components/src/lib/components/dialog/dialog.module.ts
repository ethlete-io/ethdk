import { DialogModule as CdkDialogModule } from '@angular/cdk/dialog';
import { NgModule } from '@angular/core';
import { DialogService } from './dialog.service';
import { DialogCloseDirective } from './dialog-close.directive';
import { DialogContainerComponent } from './dialog-container.component';
import { DialogTitleDirective } from './dialog-title.directive';
import { DIALOG_SCROLL_STRATEGY_PROVIDER } from './dialog.constants';

@NgModule({
  imports: [CdkDialogModule, DialogContainerComponent, DialogCloseDirective, DialogTitleDirective],
  exports: [DialogContainerComponent, DialogCloseDirective, DialogTitleDirective],
  providers: [DialogService, DIALOG_SCROLL_STRATEGY_PROVIDER],
})
export class DialogModule {}
