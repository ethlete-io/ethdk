import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-sb-overlay-panel-styles',
  template: '',
  encapsulation: ViewEncapsulation.None,
  styles: `
    .et-overlay--dialog.et-sb-overlay-panel {
      background-color: var(--et-surface-background);
      color: var(--et-surface-text);
      border-radius: 12px;
    }
  `,
})
export class OverlayStoryPanelStylesComponent {}
