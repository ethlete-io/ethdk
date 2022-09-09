import { AsyncPipe, JsonPipe } from '@angular/common';
import { Component } from '@angular/core';
import { DialogService, DialogModule } from '@ethlete/components';
import { ViewportService } from '@ethlete/core';
import { ThemeProviderDirective } from '@ethlete/theming';
import { DialogExampleComponent } from './dialog-example.component';

@Component({
  selector: 'ethlete-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [ThemeProviderDirective, AsyncPipe, JsonPipe, DialogModule],
})
export class AppComponent {
  currentTheme = 'primary';

  constructor(private _viewportService: ViewportService, private _dialog: DialogService) {}

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'primary' ? 'accent' : 'primary';
  }

  showDialog() {
    this._dialog.open(DialogExampleComponent);
  }
}
