import { SortDirection } from '@ethlete/query';

export type ArrowViewState = SortDirection | 'hint' | 'active';

export interface ArrowViewStateTransition {
  fromState?: ArrowViewState;
  toState?: ArrowViewState;
}

export interface SortHeaderColumnDef {
  name: string;
}
