import { InjectionToken } from '@angular/core';
import type { PipChromeAnimations } from './pip-chrome-animations';
import type { PipChromeState } from './pip-chrome-state';

export type PipChromeRef = {
  state: PipChromeState;
  animations: PipChromeAnimations;
};

export const PIP_CHROME_REF_TOKEN = new InjectionToken<PipChromeRef>('PIP_CHROME_REF_TOKEN');
