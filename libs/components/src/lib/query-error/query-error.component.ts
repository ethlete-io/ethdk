import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, effect, inject, input } from '@angular/core';
import { ColorTheme, ProvideColorDirective, RegisteredColorThemeName, injectErrorTheme } from '@ethlete/core';
import { ButtonComponent } from '../button';
import { IconDirective, TRIANGLE_EXCLAMATION_ICON, provideIcons } from '../icon';
import { QUERY_ERROR_TOKEN, QueryErrorDirective } from './headless';

/**
 * The default rendering of a failed query: a heading from the status, the message (or the violation list), and a
 * retry button when the failure is one worth repeating.
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
  imports: [ButtonComponent, IconDirective, NgTemplateOutlet],
  providers: [provideIcons(TRIANGLE_EXCLAMATION_ICON)],
  hostDirectives: [
    {
      directive: QueryErrorDirective,
      inputs: ['error', 'query', 'alwaysAllowRetry', 'labels'],
      outputs: ['retryRequest'],
    },
    // The panel paints itself in the error colour, and a colour scope is the only way to say that: there is no
    // global "error colour" variable, only a theme the app registered as `type: 'error'`.
    ProvideColorDirective,
  ],
  host: {
    class: 'et-query-error-host',
  },
})
export class QueryErrorComponent {
  /** @internal Read from the template; also the handle for a consumer reaching in with `viewChild`. */
  public queryError = inject(QUERY_ERROR_TOKEN);

  private provideColor = inject(ProvideColorDirective);
  private errorTheme = injectErrorTheme();

  /**
   * The colour theme for the panel and its retry button. Defaults to the app's `type: 'error'` theme, which is
   * what makes an error look like one — override for a failure that shouldn't read as alarming (a cancelled
   * request, an empty search).
   */
  public color = input<RegisteredColorThemeName | ColorTheme | null>(null);

  constructor() {
    // Forced rather than bound: the default has to come from DI (the app's error theme), and a `hostDirectives`
    // input can't be given a computed default from the component that applies it.
    effect(() => this.provideColor.forceColor(this.color() ?? this.errorTheme));
  }
}
