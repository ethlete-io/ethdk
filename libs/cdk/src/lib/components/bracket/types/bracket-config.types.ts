import { ComponentType } from '@angular/cdk/portal';

export type BracketConfig = {
  roundHeaderComponent: ComponentType<unknown> | null;
  matchComponent: ComponentType<unknown>;
};
