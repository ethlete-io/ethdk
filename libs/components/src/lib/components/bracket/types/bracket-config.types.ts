import { ComponentType } from '@angular/cdk/portal';

export interface BracketConfig {
  roundHeader?: {
    component?: ComponentType<unknown>;
  };
  match?: {
    component?: ComponentType<unknown>;
  };
}

export type RequiredBracketConfig = {
  roundHeader: {
    component: ComponentType<unknown> | null;
  };
  match: {
    component: ComponentType<unknown>;
  };
};
