import { DialogModule as CdkDialogModule } from '@angular/cdk/dialog';
import { NgModule } from '@angular/core';
import { DialogCloseDirective, DialogTitleDirective, DIALOG_SCROLL_STRATEGY_PROVIDER } from '../dialog';
import { BottomSheetContainerComponent } from './bottom-sheet-container.component';
import { BottomSheetDragHandleComponent } from './bottom-sheet-drag-handle.component';
import { BottomSheetService } from './bottom-sheet.service';

@NgModule({
  imports: [
    CdkDialogModule,
    BottomSheetContainerComponent,
    DialogCloseDirective,
    DialogTitleDirective,
    BottomSheetDragHandleComponent,
  ],
  exports: [BottomSheetContainerComponent, DialogCloseDirective, DialogTitleDirective, BottomSheetDragHandleComponent],
  providers: [BottomSheetService, DIALOG_SCROLL_STRATEGY_PROVIDER],
})
export class BottomSheetModule {}
