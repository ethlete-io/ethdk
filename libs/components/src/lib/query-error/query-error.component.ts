import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, inject, input } from '@angular/core';
import { ColorTheme, RegisteredColorThemeName } from '@ethlete/core';
import { BannerComponent } from '../banner';
import { ButtonComponent } from '../button';
import { IconDirective, TRIANGLE_EXCLAMATION_ICON, provideIcons } from '../icon';
import { QUERY_ERROR_TOKEN, QueryErrorDirective } from './headless';

/**
 * The default rendering of a failed query: a heading from the status, the message (or the violation list), and a
 * retry button when the failure is one worth repeating. It is an `et-banner` of `type="error"` with the query's
 * error in it, so it looks like every other error surface in the app.
 *
 * Render it conditionally on the error, which is also what makes the `role="alert"` announce:
 *
 * @example
 * @if (usersQuery.error(); as error) {
 *   <et-query-error [error]="error" [query]="usersQuery" />
 * }
 *
 * Both the title and the whole actions row are replaceable via `etQueryErrorTitle` / `etQueryErrorActions`, so
 * an app can key the wording off the status or add a support link without forking the component.
 */
@Component({
  selector: 'et-query-error',
  templateUrl: './query-error.component.html',
  styleUrl: './query-error.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [BannerComponent, ButtonComponent, IconDirective, NgTemplateOutlet],
  providers: [provideIcons(TRIANGLE_EXCLAMATION_ICON)],
  hostDirectives: [
    {
      directive: QueryErrorDirective,
      inputs: ['error', 'query', 'alwaysAllowRetry', 'labels'],
      outputs: ['retryRequest'],
    },
  ],
  host: {
    class: 'et-query-error-host',
  },
})
export class QueryErrorComponent {
  /** @internal Read from the template; also the handle for a consumer reaching in with `viewChild`. */
  public queryError = inject(QUERY_ERROR_TOKEN);

  /**
   * The colour theme for the panel and its retry button. Defaults to the app's `type: 'error'` theme, which is
   * what makes an error look like one - override for a failure that shouldn't read as alarming (a cancelled
   * request, an empty search).
   */
  public color = input<RegisteredColorThemeName | ColorTheme | null>(null);
}
