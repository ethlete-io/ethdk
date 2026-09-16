import { Component, inject, ViewEncapsulation } from '@angular/core';
import { provideOverlay } from '@ethlete/components';
import {
  provideColorThemesWithTailwind4,
  ProvideSurfaceDirective,
  provideSurfaceThemesWithTailwind4,
  setInputSignal,
} from '@ethlete/core';
import { applicationConfig, componentWrapperDecorator, moduleMetadata, Preview } from '@storybook/angular';
import { SURFACE_THEMES } from '../src/surface-themes';
import { THEMES } from '../src/themes';

@Component({
  selector: 'ethlete-tt-design-root',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [ProvideSurfaceDirective],
  host: {
    style:
      'display:block;min-height:100vh;background:var(--et-surface-background-solid);color:var(--et-surface-color-solid)',
  },
})
class DesignRootComponent {
  private provideSurface = inject(ProvideSurfaceDirective);

  constructor() {
    setInputSignal(this.provideSurface.surface, 'dark');
  }
}

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
  },

  decorators: [
    applicationConfig({
      providers: [
        ...provideColorThemesWithTailwind4(THEMES),
        ...provideSurfaceThemesWithTailwind4(SURFACE_THEMES),
        ...provideOverlay(),
      ],
    }),
    moduleMetadata({ imports: [DesignRootComponent] }),
    componentWrapperDecorator((story) => `<ethlete-tt-design-root>${story}</ethlete-tt-design-root>`),
  ],
};

export default preview;
