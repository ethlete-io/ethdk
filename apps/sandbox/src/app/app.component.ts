import { AsyncPipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { BottomSheetService, DialogService } from '@ethlete/components';
import { ViewportService } from '@ethlete/core';
import { ThemeProviderDirective } from '@ethlete/theming';
import { BottomSheetExampleComponent } from './bottom-sheet-example.component';
import { DialogExampleComponent } from './dialog-example.component';

@Component({
  selector: 'ethlete-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [ThemeProviderDirective, AsyncPipe, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent {
  currentTheme = 'primary';

  constructor(
    private _viewportService: ViewportService,
    private _dialogService: DialogService,
    private _bottomSheetService: BottomSheetService,
  ) {}

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'primary' ? 'accent' : 'primary';
  }

  showDialog() {
    this._dialogService.open(DialogExampleComponent);
  }

  showBottomSheet() {
    this._bottomSheetService.open(BottomSheetExampleComponent);
  }
}
