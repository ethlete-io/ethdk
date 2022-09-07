import { Component } from '@angular/core';
import { ThemeProviderDirective } from '@ethlete/theming';

@Component({
  selector: 'ethlete-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [ThemeProviderDirective],
})
export class AppComponent {
  currentTheme = 'primary';

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'primary' ? 'accent' : 'primary';
  }
}
