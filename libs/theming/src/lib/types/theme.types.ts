import { ElementRef } from '@angular/core';

export interface ThemeConfig {
  themes: string[];
  defaultTheme: string;
}

export interface Themeable {
  _theme: string;
  _elementRef: ElementRef<HTMLElement>;
  _themeConfig: ThemeConfig;
}
