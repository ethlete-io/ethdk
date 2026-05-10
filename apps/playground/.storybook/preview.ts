import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import {
  provideColorThemesWithTailwind4,
  ProvideSurfaceDirective,
  provideSurfaceThemesWithTailwind4,
  setInputSignal,
  SurfacedDirective,
} from '@ethlete/core';
import { applicationConfig, componentWrapperDecorator, moduleMetadata, type Preview } from '@storybook/angular';
import { SURFACE_THEMES } from '../src/surface-themes';
import { THEMES } from '../src/themes';

const customViewports = {
  sm: {
    name: 'SM',
    styles: {
      width: '640px',
      height: '480px',
    },
  },
  md: {
    name: 'MD',
    styles: {
      width: '768px',
      height: '576px',
    },
  },
  lg: {
    name: 'LG',
    styles: {
      width: '1024px',
      height: '960px',
    },
  },
  xl: {
    name: 'XL',
    styles: {
      width: '1280px',
      height: '1024px',
    },
  },
  '2xl': {
    name: '2XL',
    styles: {
      width: '1536px',
      height: '1280px',
    },
  },
  iPhoneSE: {
    name: 'iPhone SE',
    styles: {
      width: '375px',
      height: '667px',
    },
  },
  iPhone12Pro: {
    name: 'iPhone 12 Pro',
    styles: {
      width: '390px',
      height: '844px',
    },
  },
  iPadMini: {
    name: 'iPad Mini',
    styles: {
      width: '768px',
      height: '1024px',
    },
  },
  iPadAir: {
    name: 'iPad Air',
    styles: {
      width: '820px',
      height: '1180px',
    },
  },
};

@Component({
  selector: 'ethlete-sb-root',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [SurfacedDirective, ProvideSurfaceDirective],
  host: {
    style: 'display: contents',
  },
})
class StorybookRootComponent {
  private provideSurface = inject(ProvideSurfaceDirective);
  private elementRef = inject(ElementRef);

  constructor() {
    setInputSignal(this.provideSurface.surface, 'dark');

    afterNextRender(() => {
      const host = this.elementRef.nativeElement as HTMLElement;
      const styles = getComputedStyle(host);
      const bg = styles.getPropertyValue('--et-surface-background-solid').trim();
      const color = styles.getPropertyValue('--et-surface-color-solid').trim();

      document.documentElement.style.background = bg;
      document.documentElement.style.color = color;
      document.documentElement.style.colorScheme = 'dark';
    });
  }
}

const preview: Preview = {
  parameters: {
    options: {
      // @ts-expect-error cant use types here
      storySort: (a, b) => {
        // Always put "Overview" first in any folder
        if (a.title.endsWith('/Overview')) return -1;
        if (b.title.endsWith('/Overview')) return 1;

        // Otherwise sort alphabetically
        return a.title.localeCompare(b.title);
      },
    },
    viewport: { viewports: customViewports },
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: '#333',
        },
      ],
    },
  },

  decorators: [
    applicationConfig({
      providers: [...provideColorThemesWithTailwind4(THEMES), ...provideSurfaceThemesWithTailwind4(SURFACE_THEMES)],
    }),
    moduleMetadata({
      imports: [StorybookRootComponent],
    }),
    componentWrapperDecorator((story) => `<ethlete-sb-root>${story}</ethlete-sb-root>`),
  ],
  tags: ['autodocs'],
};

export default preview;
