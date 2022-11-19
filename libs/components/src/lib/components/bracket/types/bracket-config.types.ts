import { ComponentType } from '@angular/cdk/portal';

export interface BracketConfig {
  roundHeaderComponent: ComponentType<unknown> | null;
  matchComponent: ComponentType<unknown>;
}
