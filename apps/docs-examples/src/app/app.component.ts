import { DOCUMENT, NgComponentOutlet } from '@angular/common';
import { Component, ViewEncapsulation, effect, inject, signal } from '@angular/core';
import { ProvideSurfaceDirective, injectColorScheme } from '@ethlete/core';
import { injectDocsExample } from './docs-example';

@Component({
  selector: 'app-root',
  template: `
    <div [etProvideSurface]="theme()" [attr.data-theme]="theme()" class="app-examples-root">
      @if (example.component(); as component) {
        <ng-container *ngComponentOutlet="component" />
      } @else {
        <p>Unknown example "{{ example.id }}".</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NgComponentOutlet, ProvideSurfaceDirective],
  host: { '(window:message)': 'applyParentTheme($event)' },
})
export class AppComponent {
  protected example = injectDocsExample();
  private document = inject(DOCUMENT);

  protected theme = signal<'light' | 'dark'>(this.example.theme === 'light' ? 'light' : 'dark');

  constructor() {
    const colorScheme = injectColorScheme();

    effect(() => colorScheme.setMode(this.theme()));
  }

  protected applyParentTheme(event: MessageEvent) {
    if (event.source !== this.document.defaultView?.parent || event.data?.type !== 'et-docs-theme') return;

    this.theme.set(event.data.theme === 'light' ? 'light' : 'dark');
  }
}
