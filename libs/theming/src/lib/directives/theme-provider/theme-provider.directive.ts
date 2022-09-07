import { Directive, ElementRef, Inject, Input, OnInit } from '@angular/core';
import { THEME_CONFIG } from '../../constants';
import { Themeable, ThemeConfig } from '../../types';
import { applyTheme } from '../../utils';
import { THEME_PROVIDER } from './theme-provider.directive.constants';

@Directive({
  selector: 'et-theme-provider',
  standalone: true,
  providers: [{ provide: THEME_PROVIDER, useExisting: ThemeProviderDirective }],
})
export class ThemeProviderDirective implements OnInit, Themeable {
  @Input()
  get theme() {
    return this._theme;
  }
  set theme(v: string) {
    this._theme = v;
    applyTheme(this);
  }
  _theme!: string;

  constructor(@Inject(THEME_CONFIG) public _themeConfig: ThemeConfig, public _elementRef: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    applyTheme(this);
  }
}
