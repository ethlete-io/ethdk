import { Provider } from '@angular/core';
import { injectPipChromeManager, providePipChromeManager } from './pip-chrome-manager';
import { DEFAULT_PIP_CHROME_CONFIG } from './pip/pip-chrome.config';
import { providePipManager, injectPipManager } from './pip-manager';
import { StreamPipOptions, STREAM_PIP_TOKEN } from './stream-pip.token';

const DEFAULT_STREAM_PIP_OPTIONS: StreamPipOptions = {
  pipChromeComponent: null,
  pipChrome: DEFAULT_PIP_CHROME_CONFIG,
  pipWindow: {
    minWidth: 160,
    maxWidth: 640,
    minHeight: 90,
    maxHeight: 360,
    desiredSize: 400,
    collapsePeek: 40,
    viewportPadding: 8,
  },
};

/** Registers the floating picture-in-picture window and controls for stream player slots in scope. */
export const provideStreamPip = (options: Partial<StreamPipOptions> = {}): Provider[] => {
  const streamPipOptions = {
    ...DEFAULT_STREAM_PIP_OPTIONS,
    ...options,
    pipChrome: {
      ...DEFAULT_PIP_CHROME_CONFIG,
      ...(options.pipChrome ?? {}),
    },
    pipWindow: {
      ...DEFAULT_STREAM_PIP_OPTIONS.pipWindow,
      ...(options.pipWindow ?? {}),
    },
  };

  return [
    providePipManager(),
    providePipChromeManager(),
    {
      provide: STREAM_PIP_TOKEN,
      useFactory: () => {
        const manager = injectPipManager();
        injectPipChromeManager();

        return { manager, options: streamPipOptions };
      },
    },
  ];
};
