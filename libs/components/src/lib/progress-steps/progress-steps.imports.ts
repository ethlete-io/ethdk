import { ProgressStepComponent } from './progress-step.component';
import { ProgressStepRouterActiveDirective } from './progress-step-router-active.directive';
import { ProgressStepsComponent } from './progress-steps.component';

export const PROGRESS_STEPS_IMPORTS = [
  ProgressStepsComponent,
  ProgressStepComponent,
  ProgressStepRouterActiveDirective,
] as const;
