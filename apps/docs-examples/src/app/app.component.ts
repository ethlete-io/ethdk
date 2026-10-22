import { DOCUMENT, NgComponentOutlet } from '@angular/common';
import { Component, ViewEncapsulation, inject, linkedSignal, resource } from '@angular/core';
import { ProvideSurfaceDirective, injectQueryParam } from '@ethlete/core';
import { EXAMPLES } from '../examples';

@Component({
  selector: 'app-root',
  template: `
    <div [etProvideSurface]="theme()" [attr.data-theme]="theme()" class="app-examples-root">
      @if (example.value(); as component) {
        <ng-container *ngComponentOutlet="component" />
      } @else if (!example.isLoading()) {
        <p>Unknown example "{{ id() }}".</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NgComponentOutlet, ProvideSurfaceDirective],
  host: { '(window:message)': 'applyParentTheme($event)' },
})
export class AppComponent {
  protected id = injectQueryParam('id');
  private themeParam = injectQueryParam('theme');
  private document = inject(DOCUMENT);

  protected theme = linkedSignal(() => (this.themeParam() === 'light' ? 'light' : 'dark'));

  protected example = resource({
    params: () => this.id() ?? undefined,
    loader: ({ params }) => EXAMPLES[params]?.() ?? Promise.resolve(null),
  });

  protected applyParentTheme(event: MessageEvent) {
    if (event.source !== this.document.defaultView?.parent || event.data?.type !== 'et-docs-theme') return;

    this.theme.set(event.data.theme === 'light' ? 'light' : 'dark');
  }
}
