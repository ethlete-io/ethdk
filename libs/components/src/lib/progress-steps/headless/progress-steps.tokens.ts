import { InjectionToken } from '@angular/core';

export type ProgressStepsRegistry = {
  registerStep(step: object): void;
  unregisterStep(step: object): void;
};

export const PROGRESS_STEPS_REGISTRY_TOKEN = new InjectionToken<ProgressStepsRegistry>('PROGRESS_STEPS_REGISTRY_TOKEN');
