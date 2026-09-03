import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { signalDeferredLoading } from '@ethlete/core';
import { SpinnerComponent } from '../loader';
import type { MenuSearchDirective } from './headless/menu-search.directive';

@Component({
  selector: 'et-menu-search-spinner',
  template: `
    @if (showSpinner()) {
      <et-spinner class="et-menu-search-spinner" diameter="16" />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SpinnerComponent],
})
export class MenuSearchSpinnerComponent {
  public search = input.required<MenuSearchDirective>();

  protected showSpinner = signalDeferredLoading(computed(() => this.search().loading()));
}
