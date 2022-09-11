import { DialogModule as CdkDialogModule } from '@angular/cdk/dialog';
import { NgModule } from '@angular/core';
import { DialogContainerComponent } from './components';
import { DIALOG_SCROLL_STRATEGY_PROVIDER } from './constants';
import { DialogCloseDirective, DialogTitleDirective } from './partials';
import { DialogService } from './services';

@NgModule({
  imports: [CdkDialogModule, DialogContainerComponent, DialogCloseDirective, DialogTitleDirective],
  exports: [DialogContainerComponent, DialogCloseDirective, DialogTitleDirective],
  providers: [DialogService, DIALOG_SCROLL_STRATEGY_PROVIDER],
})
export class DialogModule {}
