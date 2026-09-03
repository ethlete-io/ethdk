import { InjectionToken, Type } from '@angular/core';
import { PipManager } from './stream-manager.types';

export type StreamPipOptions = {
  pipChromeComponent: Type<unknown> | null;
  pipChrome: {
    controlsColor?: string;
  };
  pipWindow: {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
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
