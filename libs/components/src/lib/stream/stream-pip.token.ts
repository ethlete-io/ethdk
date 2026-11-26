import { RegisteredColorThemeName } from '@ethlete/core';
import { InjectionToken, Type } from '@angular/core';
import { PipManager } from './stream-manager.types';

export type StreamPipOptions = {
  pipChromeComponent: Type<unknown> | null;
  pipSlotPlaceholderComponent: Type<unknown> | null;
  pipChrome: {
    controlsColor?: RegisteredColorThemeName;
  };
  pipWindow: {
    minWidth: number;
    maxWidth: number;
    desiredSize: number;
    collapsePeek: number;
    viewportPadding: number;
  };
};

export type StreamPipRegistration = {
  manager: PipManager;
  options: StreamPipOptions;
};

export const STREAM_PIP_TOKEN = new InjectionToken<StreamPipRegistration>('StreamPip');
