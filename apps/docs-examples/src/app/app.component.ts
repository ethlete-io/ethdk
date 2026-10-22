import { NgComponentOutlet } from '@angular/common';
import { Component, ViewEncapsulation, resource } from '@angular/core';
import { ProvideSurfaceDirective, injectQueryParam } from '@ethlete/core';
import { EXAMPLES } from '../examples';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-examples-root" etProvideSurface="dark">
      @if (example.value(); as component) {
        <ng-container *ngComponentOutlet="component" />
      } @else if (!example.isLoading()) {
        <p>Unknown example "{{ id() }}".</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NgComponentOutlet, ProvideSurfaceDirective],
})
export class AppComponent {
  protected id = injectQueryParam('id');

  protected example = resource({
    params: () => this.id() ?? undefined,
    loader: ({ params }) => EXAMPLES[params]?.() ?? Promise.resolve(null),
  });
}
