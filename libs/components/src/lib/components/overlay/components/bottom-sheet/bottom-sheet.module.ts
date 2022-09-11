import { DialogModule as CdkDialogModule } from '@angular/cdk/dialog';
import { NgModule } from '@angular/core';
import { BottomSheetContainerComponent } from './components';
import { BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER } from './constants';
import { BottomSheetTitleDirective, BottomSheetDragHandleComponent } from './partials';
import { BottomSheetService } from './services';

@NgModule({
  imports: [CdkDialogModule, BottomSheetContainerComponent, BottomSheetTitleDirective, BottomSheetDragHandleComponent],
  exports: [BottomSheetContainerComponent, BottomSheetTitleDirective, BottomSheetDragHandleComponent],
  providers: [BottomSheetService, BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER],
})
export class BottomSheetModule {}
