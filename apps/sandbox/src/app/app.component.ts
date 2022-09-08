import { AsyncPipe, JsonPipe } from '@angular/common';
import { Component } from '@angular/core';
import { ViewportService } from '@ethlete/core';
import { ThemeProviderDirective } from '@ethlete/theming';

@Component({
  selector: 'ethlete-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [ThemeProviderDirective, AsyncPipe, JsonPipe],
})
export class AppComponent {
  currentTheme = 'primary';

  constructor(private _viewportService: ViewportService) {}

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'primary' ? 'accent' : 'primary';
  }
}
