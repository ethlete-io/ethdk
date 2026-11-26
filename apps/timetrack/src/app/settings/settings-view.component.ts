import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BANNER_IMPORTS, NAV_TAB_IMPORTS, SpinnerComponent } from '@ethlete/components';
import { injectTimetrackSettings } from './settings';

/**
 * Everything the app cannot work out for itself, in five tabs.
 *
 * It is tabs rather than one column because the screen answers five unrelated questions, and reading four
 * of them to find the fifth is what made the old one a wall of text. Every explanation that used to be a
 * paragraph is now behind the glyph next to the thing it explains — see `ethlete-explain`. The text was
 * not the problem; printing all of it at once was.
 */
@Component({
  selector: 'ethlete-settings',
  template: `
    <div class="flex min-h-0 grow flex-col">
      <header class="flex shrink-0 items-center gap-3 px-6 pt-6">
        <h2 class="text-h3">Settings</h2>

        @if (store.isLoading()) {
          <et-spinner size="sm" />
        }
      </header>

      @if (store.failure(); as failure) {
        <div class="shrink-0 px-6 pt-4">
          <et-banner [description]="failure" type="error" heading="A setting could not be stored" />
        </div>
      }

      <et-nav-tabs class="shrink-0 px-6 pt-4">
        @for (tab of TABS; track tab.path) {
          <a [et-nav-tab-link]="tab.path" [attr.data-settings-tab]="tab.label">{{ tab.label }}</a>
        }
      </et-nav-tabs>

      @if (!store.isLoading()) {
        <et-nav-tabs-outlet class="min-h-0 grow overflow-y-auto px-6 pb-6">
          <router-outlet />
        </et-nav-tabs-outlet>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BANNER_IMPORTS, NAV_TAB_IMPORTS, RouterOutlet, SpinnerComponent],
  host: { class: 'flex min-h-0 grow flex-col' },
})
export class SettingsViewComponent {
  protected store = injectTimetrackSettings();

  protected readonly TABS = [
    { path: '/settings/day', label: 'The day' },
    { path: '/settings/jira', label: 'Jira' },
    { path: '/settings/projects', label: 'Projects' },
    { path: '/settings/sources', label: 'Sources' },
    { path: '/settings/suggestions', label: 'Suggestions' },
  ];
}
