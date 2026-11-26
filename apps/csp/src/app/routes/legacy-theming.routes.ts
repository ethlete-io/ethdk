import { Component, ViewEncapsulation } from '@angular/core';
import { Routes } from '@angular/router';
import { provideColorThemes } from '@ethlete/core';
import { APP_COLOR_THEMES } from '../themes';

@Component({
  selector: 'app-legacy-theming',
  template: '<p class="et-theme--app-accent" data-testid="legacy">Legacy runtime colour themes</p>',
  encapsulation: ViewEncapsulation.None,
})
export class LegacyThemingRouteComponent {}

export default [
  { path: '', component: LegacyThemingRouteComponent, providers: [provideColorThemes(APP_COLOR_THEMES)] },
] satisfies Routes;
