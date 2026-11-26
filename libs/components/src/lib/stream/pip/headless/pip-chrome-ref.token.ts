import { InjectionToken } from '@angular/core';
import { PipChromeAnimations } from './pip-chrome-animations';
import { PipChromeState } from './pip-chrome-state';

export type PipChromeRef = {
  state: PipChromeState;
  animations: PipChromeAnimations;
};

export const PIP_CHROME_REF_TOKEN = new InjectionToken<PipChromeRef>('PIP_CHROME_REF_TOKEN');
