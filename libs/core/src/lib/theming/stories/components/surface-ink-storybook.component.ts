import { Component, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective } from '../../color-interactive.directive';
import { ProvideColorDirective } from '../../provide-color.directive';
import { ProvideSurfaceDirective } from '../../provide-surface.directive';

@Component({
  selector: 'et-sb-surface-ink',
  template: `
    <div class="flex flex-col gap-4 p-8 font-sans" etProvideColor="danger">
      <div class="et-sb-surface-ink-panel" etProvideSurface="dark">
        <span class="et-sb-surface-ink-text" data-testid="dark">Ink on dark</span>
        <div class="et-sb-surface-ink-panel" etProvideSurface="light">
          <span class="et-sb-surface-ink-text" data-testid="light-in-dark">Ink on light</span>
          <span class="text-et-theme-ink" data-testid="utility-light">Utility ink on light</span>
          <button class="et-sb-surface-ink-text" data-testid="interactive-light" etColorInteractive type="button">
            Interactive ink on light
          </button>
          <div class="et-sb-surface-ink-panel" etProvideSurface="dark-elevated">
            <span class="et-sb-surface-ink-text" data-testid="dark-in-light">Ink on dark again</span>
          </div>
          <div class="et-sb-surface-ink-panel" etProvideColor="success">
            <span class="et-sb-surface-ink-text" data-testid="success-light">Success ink on light</span>
          </div>
          <div class="et-sb-surface-ink-panel" etProvideColor="warning">
            <span class="et-sb-surface-ink-text" data-testid="warning-light">Warning has one ink</span>
          </div>
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective, ProvideSurfaceDirective, ColorInteractiveDirective],
  styles: `
    @layer components {
      .et-sb-surface-ink-panel {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 16px;
        background: var(--et-surface-background-solid);
      }

      .et-sb-surface-ink-text {
        color: var(--et-theme-color-ink-solid);
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        text-align: start;
      }
    }
  `,
})
export class SurfaceInkStorybookComponent {}
