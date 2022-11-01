import { ComponentType } from '@angular/cdk/portal';

export interface BracketConfig {
  roundHeader?: {
    component?: ComponentType<unknown>;
  };
  match?: {
    headerComponent?: ComponentType<unknown>;
    bodyComponent?: ComponentType<unknown>;
    footerComponent?: ComponentType<unknown>;
  };
}

export type RequiredBracketConfig = {
  roundHeader: {
    component: ComponentType<unknown> | null;
  };
  match: {
    headerComponent: ComponentType<unknown> | null;
    bodyComponent: ComponentType<unknown>;
    footerComponent: ComponentType<unknown> | null;
  };
};
